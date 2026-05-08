/** Seed file store — hiển thị tải về giống dữ liệu mock cũ */
export const MOCK_FILE_SEED: Record<string, { filename: string; body: string; mime: string }> = {
  'getgroup-uid-demo': {
    filename: 'GetGroupUid.py',
    mime: 'text/x-python; charset=utf-8',
    body: `# Donix Portal — file demo (mock)
# Thay bằng script thật của bạn

def list_groups(uid: str) -> None:
    print(f"Fetch groups for uid={uid} (demo)")

if __name__ == "__main__":
    list_groups("100012345678")
`,
  },
  'convert-url-demo': {
    filename: 'convert_group_url.zip.txt',
    mime: 'text/plain; charset=utf-8',
    body: 'ZIP demo — thay bằng file .zip thật trên storage (S3, disk, ...).',
  },
};
