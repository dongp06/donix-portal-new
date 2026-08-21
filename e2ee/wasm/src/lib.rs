use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine as _};
use libsignal_protocol::{
    kem, message_decrypt, message_encrypt, process_prekey_bundle, CiphertextMessage,
    CiphertextMessageType, DeviceId, Direction, Fingerprint, GenericSignedPreKey, IdentityChange,
    IdentityKey, IdentityKeyPair, IdentityKeyStore, KeyPair, KyberPreKeyId, KyberPreKeyRecord,
    KyberPreKeyStore, PreKeyBundle, PreKeyId, PreKeyRecord, PreKeySignalMessage, PreKeyStore,
    ProtocolAddress, PublicKey, SessionRecord, SessionStore, SignalMessage, SignalProtocolError,
    SignedPreKeyId, SignedPreKeyRecord, SignedPreKeyStore, Timestamp,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

fn encode(bytes: &[u8]) -> String {
    STANDARD_NO_PAD.encode(bytes)
}

fn decode(value: &str) -> Result<Vec<u8>, JsValue> {
    STANDARD_NO_PAD
        .decode(value)
        .map_err(|_| JsValue::from_str("invalid base64"))
}

fn signal_error<E: std::fmt::Debug>(error: E) -> JsValue {
    JsValue::from_str(&format!("{error:?}"))
}

fn address(name: &str, device_id: u8) -> Result<ProtocolAddress, JsValue> {
    let id = DeviceId::new(device_id)
        .map_err(|_| JsValue::from_str("device_id must be in the range 1..=127"))?;
    Ok(ProtocolAddress::new(name.to_owned(), id))
}

fn now_millis() -> u64 {
    js_sys::Date::now().max(0.0) as u64
}

fn now_system_time() -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(now_millis())
}

#[derive(Clone)]
struct IdentityStore {
    key_pair: IdentityKeyPair,
    registration_id: u32,
    known: HashMap<ProtocolAddress, IdentityKey>,
}

#[async_trait(?Send)]
impl IdentityKeyStore for IdentityStore {
    async fn get_identity_key_pair(&self) -> Result<IdentityKeyPair, SignalProtocolError> {
        Ok(self.key_pair)
    }

    async fn get_local_registration_id(&self) -> Result<u32, SignalProtocolError> {
        Ok(self.registration_id)
    }

    async fn save_identity(
        &mut self,
        name: &ProtocolAddress,
        identity: &IdentityKey,
    ) -> Result<IdentityChange, SignalProtocolError> {
        let result = match self.known.get(name) {
            None => IdentityChange::NewOrUnchanged,
            Some(existing) if existing == identity => IdentityChange::NewOrUnchanged,
            Some(_) => IdentityChange::ReplacedExisting,
        };
        self.known.insert(name.clone(), *identity);
        Ok(result)
    }

    async fn is_trusted_identity(
        &self,
        name: &ProtocolAddress,
        identity: &IdentityKey,
        _direction: Direction,
    ) -> Result<bool, SignalProtocolError> {
        Ok(self.known.get(name).is_none_or(|known| known == identity))
    }

    async fn get_identity(
        &self,
        name: &ProtocolAddress,
    ) -> Result<Option<IdentityKey>, SignalProtocolError> {
        Ok(self.known.get(name).copied())
    }
}

#[derive(Clone, Default)]
struct PreKeyStoreImpl {
    values: HashMap<PreKeyId, PreKeyRecord>,
}

#[async_trait(?Send)]
impl PreKeyStore for PreKeyStoreImpl {
    async fn get_pre_key(&self, id: PreKeyId) -> Result<PreKeyRecord, SignalProtocolError> {
        self.values
            .get(&id)
            .cloned()
            .ok_or(SignalProtocolError::InvalidPreKeyId)
    }

    async fn save_pre_key(
        &mut self,
        id: PreKeyId,
        record: &PreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.values.insert(id, record.clone());
        Ok(())
    }

    async fn remove_pre_key(&mut self, id: PreKeyId) -> Result<(), SignalProtocolError> {
        self.values.remove(&id);
        Ok(())
    }
}

#[derive(Clone, Default)]
struct SignedPreKeyStoreImpl {
    values: HashMap<SignedPreKeyId, SignedPreKeyRecord>,
}

#[async_trait(?Send)]
impl SignedPreKeyStore for SignedPreKeyStoreImpl {
    async fn get_signed_pre_key(
        &self,
        id: SignedPreKeyId,
    ) -> Result<SignedPreKeyRecord, SignalProtocolError> {
        self.values
            .get(&id)
            .cloned()
            .ok_or(SignalProtocolError::InvalidSignedPreKeyId)
    }

    async fn save_signed_pre_key(
        &mut self,
        id: SignedPreKeyId,
        record: &SignedPreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.values.insert(id, record.clone());
        Ok(())
    }
}

#[derive(Clone, Default)]
struct KyberPreKeyStoreImpl {
    values: HashMap<KyberPreKeyId, KyberPreKeyRecord>,
    used: HashSet<(KyberPreKeyId, SignedPreKeyId, Vec<u8>)>,
}

#[async_trait(?Send)]
impl KyberPreKeyStore for KyberPreKeyStoreImpl {
    async fn get_kyber_pre_key(
        &self,
        id: KyberPreKeyId,
    ) -> Result<KyberPreKeyRecord, SignalProtocolError> {
        self.values
            .get(&id)
            .cloned()
            .ok_or(SignalProtocolError::InvalidKyberPreKeyId)
    }

    async fn save_kyber_pre_key(
        &mut self,
        id: KyberPreKeyId,
        record: &KyberPreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.values.insert(id, record.clone());
        Ok(())
    }

    async fn mark_kyber_pre_key_used(
        &mut self,
        kyber_id: KyberPreKeyId,
        signed_id: SignedPreKeyId,
        base_key: &PublicKey,
    ) -> Result<(), SignalProtocolError> {
        let key = (kyber_id, signed_id, base_key.serialize().to_vec());
        if !self.used.insert(key) {
            return Err(SignalProtocolError::InvalidMessage(
                CiphertextMessageType::PreKey,
                "reused base key".to_owned(),
            ));
        }
        Ok(())
    }
}

#[derive(Clone, Default)]
struct SessionStoreImpl {
    values: HashMap<ProtocolAddress, SessionRecord>,
}

#[async_trait(?Send)]
impl SessionStore for SessionStoreImpl {
    async fn load_session(
        &self,
        name: &ProtocolAddress,
    ) -> Result<Option<SessionRecord>, SignalProtocolError> {
        Ok(self.values.get(name).cloned())
    }

    async fn store_session(
        &mut self,
        name: &ProtocolAddress,
        record: &SessionRecord,
    ) -> Result<(), SignalProtocolError> {
        self.values.insert(name.clone(), record.clone());
        Ok(())
    }
}

struct Store {
    identity: IdentityStore,
    pre_keys: PreKeyStoreImpl,
    signed_pre_keys: SignedPreKeyStoreImpl,
    kyber_pre_keys: KyberPreKeyStoreImpl,
    sessions: SessionStoreImpl,
}

#[derive(Serialize, Deserialize)]
struct BundleWire {
    registration_id: u32,
    device_id: u8,
    pre_key_id: Option<u32>,
    pre_key_public: Option<String>,
    signed_pre_key_id: u32,
    signed_pre_key_public: String,
    signed_pre_key_signature: String,
    identity_key: String,
    kyber_pre_key_id: u32,
    kyber_pre_key_public: String,
    kyber_pre_key_signature: String,
}

#[derive(Serialize, Deserialize)]
struct MessageWire {
    message_type: u8,
    ciphertext: String,
}

#[derive(Serialize)]
struct PreKeyWire {
    id: u32,
    public_key: String,
}

#[derive(Serialize, Deserialize)]
struct SessionWire {
    name: String,
    device_id: u8,
    record: String,
}

#[derive(Serialize, Deserialize)]
struct IdentityWire {
    name: String,
    device_id: u8,
    identity: String,
}

#[derive(Serialize, Deserialize)]
struct SnapshotWire {
    user_name: String,
    device_id: u8,
    registration_id: u32,
    identity_key_pair: String,
    pre_keys: Vec<String>,
    signed_pre_keys: Vec<String>,
    kyber_pre_keys: Vec<String>,
    sessions: Vec<SessionWire>,
    identities: Vec<IdentityWire>,
    used_kyber: Vec<String>,
}

#[derive(Serialize)]
struct SafetyNumberWire {
    display: String,
    scannable: String,
}

#[wasm_bindgen]
pub struct SignalDevice {
    user_name: String,
    device_id: u8,
    store: Store,
}

impl SignalDevice {
    fn bundle(&self) -> Result<BundleWire, JsValue> {
        let (pre_key_id, pre_key_public) =
            if let Some((id, record)) = self.store.pre_keys.values.iter().min_by_key(|(id, _)| *id) {
                (
                    Some((*id).into()),
                    Some(encode(
                        &record.public_key().map_err(signal_error)?.serialize(),
                    )),
                )
            } else {
                (None, None)
            };
        let signed = self
            .store
            .signed_pre_keys
            .values
            .values()
            .next()
            .ok_or_else(|| JsValue::from_str("signed pre-key missing"))?;
        let kyber = self
            .store
            .kyber_pre_keys
            .values
            .values()
            .next()
            .ok_or_else(|| JsValue::from_str("Kyber pre-key missing"))?;
        let identity = self.store.identity.key_pair.identity_key();
        Ok(BundleWire {
            registration_id: self.store.identity.registration_id,
            device_id: self.device_id,
            pre_key_id,
            pre_key_public,
            signed_pre_key_id: signed.id().map_err(signal_error)?.into(),
            signed_pre_key_public: encode(&signed.public_key().map_err(signal_error)?.serialize()),
            signed_pre_key_signature: encode(&signed.signature().map_err(signal_error)?),
            identity_key: encode(&identity.serialize()),
            kyber_pre_key_id: kyber.id().map_err(signal_error)?.into(),
            kyber_pre_key_public: encode(&kyber.public_key().map_err(signal_error)?.serialize()),
            kyber_pre_key_signature: encode(&kyber.signature().map_err(signal_error)?),
        })
    }

    fn local_address(&self) -> Result<ProtocolAddress, JsValue> {
        address(&self.user_name, self.device_id)
    }

    fn remote_address(name: &str, device_id: u8) -> Result<ProtocolAddress, JsValue> {
        address(name, device_id)
    }

    fn snapshot(&self) -> Result<SnapshotWire, JsValue> {
        let sessions = self
            .store
            .sessions
            .values
            .iter()
            .map(|(name, record)| {
                Ok(SessionWire {
                    name: name.name().to_owned(),
                    device_id: name.device_id().into(),
                    record: encode(&record.serialize().map_err(signal_error)?),
                })
            })
            .collect::<Result<Vec<_>, JsValue>>()?;
        let identities = self
            .store
            .identity
            .known
            .iter()
            .map(|(name, identity)| IdentityWire {
                name: name.name().to_owned(),
                device_id: name.device_id().into(),
                identity: encode(&identity.serialize()),
            })
            .collect();
        let used_kyber = self
            .store
            .kyber_pre_keys
            .used
            .iter()
            .map(|(kyber, signed, base)| {
                format!("{}:{}:{}", u32::from(*kyber), u32::from(*signed), encode(base))
            })
            .collect();
        Ok(SnapshotWire {
            user_name: self.user_name.clone(),
            device_id: self.device_id,
            registration_id: self.store.identity.registration_id,
            identity_key_pair: encode(&self.store.identity.key_pair.serialize()),
            pre_keys: self
                .store
                .pre_keys
                .values
                .values()
                .map(|record| encode(&record.serialize().expect("pre-key serialization")))
                .collect(),
            signed_pre_keys: self
                .store
                .signed_pre_keys
                .values
                .values()
                .map(|record| encode(&record.serialize().expect("signed pre-key serialization")))
                .collect(),
            kyber_pre_keys: self
                .store
                .kyber_pre_keys
                .values
                .values()
                .map(|record| encode(&record.serialize().expect("Kyber pre-key serialization")))
                .collect(),
            sessions,
            identities,
            used_kyber,
        })
    }
}

#[wasm_bindgen]
impl SignalDevice {
    #[wasm_bindgen(constructor)]
    pub fn generate(
        user_name: String,
        device_id: u8,
        pre_key_count: u32,
    ) -> Result<SignalDevice, JsValue> {
        address(&user_name, device_id)?;
        let mut rng = rand::rng();
        let identity_pair = IdentityKeyPair::generate(&mut rng);
        let registration_id = rng.random_range(1..=16_383);

        let signed_key_pair = KeyPair::generate(&mut rng);
        let signed_id = SignedPreKeyId::from(1);
        let signed_signature = identity_pair
            .private_key()
            .calculate_signature(&signed_key_pair.public_key.serialize(), &mut rng)
            .map_err(signal_error)?;
        let signed = SignedPreKeyRecord::new(
            signed_id,
            Timestamp::from_epoch_millis(now_millis()),
            &signed_key_pair,
            &signed_signature,
        );

        let mut pre_keys = HashMap::new();
        for id in 1..=pre_key_count.clamp(1, 100) {
            let key_pair = KeyPair::generate(&mut rng);
            let id = PreKeyId::from(id);
            pre_keys.insert(id, PreKeyRecord::new(id, &key_pair));
        }

        let kyber_id = KyberPreKeyId::from(1);
        let kyber_pair = kem::KeyPair::generate(kem::KeyType::Kyber1024, &mut rng);
        let kyber_signature = identity_pair
            .private_key()
            .calculate_signature(&kyber_pair.public_key.serialize(), &mut rng)
            .map_err(signal_error)?;
        let kyber = KyberPreKeyRecord::new(
            kyber_id,
            Timestamp::from_epoch_millis(now_millis()),
            &kyber_pair,
            &kyber_signature,
        );

        Ok(SignalDevice {
            user_name,
            device_id,
            store: Store {
                identity: IdentityStore {
                    key_pair: identity_pair,
                    registration_id,
                    known: HashMap::new(),
                },
                pre_keys: PreKeyStoreImpl { values: pre_keys },
                signed_pre_keys: SignedPreKeyStoreImpl {
                    values: HashMap::from([(signed_id, signed)]),
                },
                kyber_pre_keys: KyberPreKeyStoreImpl {
                    values: HashMap::from([(kyber_id, kyber)]),
                    used: HashSet::new(),
                },
                sessions: SessionStoreImpl::default(),
            },
        })
    }

    pub fn from_snapshot(snapshot_json: String) -> Result<SignalDevice, JsValue> {
        let snapshot: SnapshotWire = serde_json::from_str(&snapshot_json)
            .map_err(|_| JsValue::from_str("invalid Signal device snapshot"))?;
        let identity_key_pair = IdentityKeyPair::try_from(
            decode(&snapshot.identity_key_pair)?.as_slice(),
        )
        .map_err(signal_error)?;

        let mut sessions = HashMap::new();
        for wire in snapshot.sessions {
            let remote = address(&wire.name, wire.device_id)?;
            sessions.insert(
                remote,
                SessionRecord::deserialize(&decode(&wire.record)?).map_err(signal_error)?,
            );
        }

        let mut known = HashMap::new();
        for wire in snapshot.identities {
            let remote = address(&wire.name, wire.device_id)?;
            known.insert(
                remote,
                IdentityKey::decode(&decode(&wire.identity)?).map_err(signal_error)?,
            );
        }

        let mut pre_keys = HashMap::new();
        for encoded in snapshot.pre_keys {
            let record = PreKeyRecord::deserialize(&decode(&encoded)?).map_err(signal_error)?;
            pre_keys.insert(record.id().map_err(signal_error)?, record);
        }

        let mut signed_pre_keys = HashMap::new();
        for encoded in snapshot.signed_pre_keys {
            let record = SignedPreKeyRecord::deserialize(&decode(&encoded)?).map_err(signal_error)?;
            signed_pre_keys.insert(record.id().map_err(signal_error)?, record);
        }

        let mut kyber_pre_keys = HashMap::new();
        for encoded in snapshot.kyber_pre_keys {
            let record = KyberPreKeyRecord::deserialize(&decode(&encoded)?).map_err(signal_error)?;
            kyber_pre_keys.insert(record.id().map_err(signal_error)?, record);
        }

        let mut used = HashSet::new();
        for encoded in snapshot.used_kyber {
            let mut parts = encoded.splitn(3, ':');
            let kyber = parts
                .next()
                .and_then(|value| value.parse::<u32>().ok())
                .map(KyberPreKeyId::from);
            let signed = parts
                .next()
                .and_then(|value| value.parse::<u32>().ok())
                .map(SignedPreKeyId::from);
            let base = parts.next().map(decode).transpose()?;
            if let (Some(kyber), Some(signed), Some(base)) = (kyber, signed, base) {
                used.insert((kyber, signed, base));
            }
        }

        address(&snapshot.user_name, snapshot.device_id)?;
        Ok(SignalDevice {
            user_name: snapshot.user_name,
            device_id: snapshot.device_id,
            store: Store {
                identity: IdentityStore {
                    key_pair: identity_key_pair,
                    registration_id: snapshot.registration_id,
                    known,
                },
                pre_keys: PreKeyStoreImpl { values: pre_keys },
                signed_pre_keys: SignedPreKeyStoreImpl { values: signed_pre_keys },
                kyber_pre_keys: KyberPreKeyStoreImpl {
                    values: kyber_pre_keys,
                    used,
                },
                sessions: SessionStoreImpl { values: sessions },
            },
        })
    }

    pub fn bundle_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.bundle()?)
            .map_err(|_| JsValue::from_str("bundle serialization failed"))
    }

    /// Return every currently available one-time pre-key as public material.
    /// The private pre-key records stay inside the local serialized snapshot;
    /// this method is intentionally separate from `bundle_json`, because a
    /// Signal pre-key bundle carries at most one one-time pre-key per fetch.
    pub fn prekey_pool_json(&self) -> Result<String, JsValue> {
        let mut pre_keys = self
            .store
            .pre_keys
            .values
            .iter()
            .map(|(id, record)| {
                Ok(PreKeyWire {
                    id: (*id).into(),
                    public_key: encode(&record.public_key().map_err(signal_error)?.serialize()),
                })
            })
            .collect::<Result<Vec<_>, JsValue>>()?;
        pre_keys.sort_by_key(|pre_key| pre_key.id);
        serde_json::to_string(&pre_keys)
            .map_err(|_| JsValue::from_str("pre-key pool serialization failed"))
    }

    pub fn snapshot_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.snapshot()?)
            .map_err(|_| JsValue::from_str("device snapshot serialization failed"))
    }

    pub fn safety_number_json(
        &self,
        remote_name: String,
        remote_device_id: u8,
    ) -> Result<String, JsValue> {
        let remote = Self::remote_address(&remote_name, remote_device_id)?;
        let remote_identity = self
            .store
            .identity
            .known
            .get(&remote)
            .ok_or_else(|| JsValue::from_str("remote identity is not trusted yet"))?;
        let fingerprint = Fingerprint::new(
            2,
            5_200,
            self.user_name.as_bytes(),
            self.store.identity.key_pair.identity_key(),
            remote_name.as_bytes(),
            remote_identity,
        )
        .map_err(signal_error)?;
        serde_json::to_string(&SafetyNumberWire {
            display: fingerprint.display_string().map_err(signal_error)?,
            scannable: encode(&fingerprint.scannable.serialize().map_err(signal_error)?),
        })
        .map_err(|_| JsValue::from_str("safety number serialization failed"))
    }

    pub async fn process_bundle_json(
        &mut self,
        remote_name: String,
        remote_device_id: u8,
        bundle_json: String,
    ) -> Result<(), JsValue> {
        let wire: BundleWire =
            serde_json::from_str(&bundle_json).map_err(|_| JsValue::from_str("invalid bundle"))?;
        if wire.device_id != remote_device_id {
            return Err(JsValue::from_str("bundle device_id does not match its address"));
        }
        let remote = Self::remote_address(&remote_name, remote_device_id)?;
        let one_time_pre_key = match (wire.pre_key_id, wire.pre_key_public) {
            (Some(id), Some(public_key)) => Some((
                PreKeyId::from(id),
                PublicKey::deserialize(&decode(&public_key)?).map_err(signal_error)?,
            )),
            (None, None) => None,
            _ => return Err(JsValue::from_str("pre-key id and public key must be paired")),
        };
        let bundle = PreKeyBundle::new(
            wire.registration_id,
            DeviceId::new(wire.device_id)
                .map_err(|_| JsValue::from_str("invalid bundle device_id"))?,
            one_time_pre_key,
            SignedPreKeyId::from(wire.signed_pre_key_id),
            PublicKey::deserialize(&decode(&wire.signed_pre_key_public)?).map_err(signal_error)?,
            decode(&wire.signed_pre_key_signature)?,
            KyberPreKeyId::from(wire.kyber_pre_key_id),
            kem::PublicKey::deserialize(&decode(&wire.kyber_pre_key_public)?)
                .map_err(signal_error)?,
            decode(&wire.kyber_pre_key_signature)?,
            IdentityKey::decode(&decode(&wire.identity_key)?).map_err(signal_error)?,
        )
        .map_err(signal_error)?;
        let local = self.local_address()?;
        let mut rng = rand::rng();
        process_prekey_bundle(
            &remote,
            &local,
            &mut self.store.sessions,
            &mut self.store.identity,
            &bundle,
            now_system_time(),
            &mut rng,
        )
        .await
        .map_err(signal_error)
    }

    pub async fn encrypt_json(
        &mut self,
        remote_name: String,
        remote_device_id: u8,
        plaintext: Vec<u8>,
    ) -> Result<String, JsValue> {
        let remote = Self::remote_address(&remote_name, remote_device_id)?;
        let local = self.local_address()?;
        let mut rng = rand::rng();
        let message = message_encrypt(
            &plaintext,
            &remote,
            &local,
            &mut self.store.sessions,
            &mut self.store.identity,
            now_system_time(),
            &mut rng,
        )
        .await
        .map_err(signal_error)?;
        let wire = MessageWire {
            message_type: message.message_type() as u8,
            ciphertext: encode(message.serialize()),
        };
        serde_json::to_string(&wire).map_err(|_| JsValue::from_str("message serialization failed"))
    }

    pub async fn decrypt_json(
        &mut self,
        remote_name: String,
        remote_device_id: u8,
        message_json: String,
    ) -> Result<Vec<u8>, JsValue> {
        let wire: MessageWire =
            serde_json::from_str(&message_json).map_err(|_| JsValue::from_str("invalid message"))?;
        let bytes = decode(&wire.ciphertext)?;
        let message = match wire.message_type {
            x if x == CiphertextMessageType::PreKey as u8 => {
                CiphertextMessage::PreKeySignalMessage(
                    PreKeySignalMessage::try_from(bytes.as_slice()).map_err(signal_error)?,
                )
            }
            x if x == CiphertextMessageType::Whisper as u8 => CiphertextMessage::SignalMessage(
                SignalMessage::try_from(bytes.as_slice()).map_err(signal_error)?,
            ),
            _ => return Err(JsValue::from_str("unsupported Signal message type")),
        };
        let remote = Self::remote_address(&remote_name, remote_device_id)?;
        let local = self.local_address()?;
        let mut rng = rand::rng();
        message_decrypt(
            &message,
            &remote,
            &local,
            &mut self.store.sessions,
            &mut self.store.identity,
            &mut self.store.pre_keys,
            &self.store.signed_pre_keys,
            &mut self.store.kyber_pre_keys,
            &mut rng,
        )
        .await
        .map_err(signal_error)
    }
}
