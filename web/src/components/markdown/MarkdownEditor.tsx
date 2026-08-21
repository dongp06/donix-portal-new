"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  Bold,
  Check,
  Code2,
  Columns2,
  Eye,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  Loader2,
  Maximize2,
  Minus,
  Pencil,
  Quote,
  Strikethrough,
  Table2,
  UploadCloud,
} from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { cn } from "@/lib/utils";
import {
  decryptTransportResponse,
  secureRequest,
} from "@/lib/security-client";
import { toast } from "sonner";

export type MarkdownEditorPreset =
  | "community-post"
  | "official-post"
  | "resource"
  | "bot-description"
  | "pricing";
type EditorMode = "write" | "split" | "preview";
type ToolbarAction =
  | "h1"
  | "h2"
  | "h3"
  | "bold"
  | "italic"
  | "strike"
  | "link"
  | "image"
  | "quote"
  | "code"
  | "list"
  | "checklist"
  | "table"
  | "callout"
  | "divider";
type SlashCommand = {
  key: string;
  label: string;
  description: string;
  action: ToolbarAction;
};
type UploadProgress = { filename: string; progress: number } | null;

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  preset?: MarkdownEditorPreset;
  id?: string;
  placeholder?: string;
  maxLength?: number;
  minHeightClassName?: string;
  className?: string;
  disabled?: boolean;
};

const CONFIG: Record<
  MarkdownEditorPreset,
  { actions: ToolbarAction[]; usage: string; placeholder: string }
> = {
  "community-post": {
    actions: [
      "h1",
      "h2",
      "h3",
      "bold",
      "italic",
      "strike",
      "link",
      "image",
      "quote",
      "code",
      "list",
      "checklist",
      "table",
      "callout",
      "divider",
    ],
    usage: "post_inline",
    placeholder:
      "Viết nội dung bằng Markdown…\n\nBạn có thể thêm ví dụ, checklist, code hoặc ảnh minh họa.",
  },
  "official-post": {
    actions: [
      "h1",
      "h2",
      "h3",
      "bold",
      "italic",
      "strike",
      "link",
      "image",
      "quote",
      "code",
      "list",
      "checklist",
      "table",
      "callout",
      "divider",
    ],
    usage: "post_inline",
    placeholder: "Viết nội dung chính thức của thuebot.org…",
  },
  resource: {
    actions: [
      "h1",
      "h2",
      "h3",
      "bold",
      "italic",
      "strike",
      "link",
      "image",
      "quote",
      "code",
      "list",
      "checklist",
      "table",
      "callout",
      "divider",
    ],
    usage: "resource_image",
    placeholder: "Giới thiệu resource, cách sử dụng và những lưu ý cần biết…",
  },
  "bot-description": {
    actions: [
      "h2",
      "h3",
      "bold",
      "italic",
      "link",
      "image",
      "quote",
      "code",
      "list",
      "checklist",
      "table",
      "callout",
      "divider",
    ],
    usage: "post_inline",
    placeholder:
      "## Giới thiệu\n\nMô tả bot phù hợp với ai, cách sử dụng và yêu cầu cấu hình…",
  },
  pricing: {
    actions: [
      "h2",
      "h3",
      "bold",
      "italic",
      "link",
      "image",
      "list",
      "table",
      "callout",
      "divider",
    ],
    usage: "pricing_image",
    placeholder:
      "## Gói Basic — 300.000đ/tháng\n\n- 1 tài khoản\n- 5 chiến dịch\n\n## Gói Pro — 600.000đ/tháng",
  },
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    key: "h1",
    label: "Tiêu đề lớn",
    description: "Heading cấp 1",
    action: "h1",
  },
  {
    key: "h2",
    label: "Tiêu đề nhỏ",
    description: "Heading cấp 2",
    action: "h2",
  },
  {
    key: "list",
    label: "Danh sách",
    description: "Danh sách gạch đầu dòng",
    action: "list",
  },
  {
    key: "checklist",
    label: "Checklist",
    description: "Danh sách việc cần làm",
    action: "checklist",
  },
  {
    key: "quote",
    label: "Trích dẫn",
    description: "Một đoạn cần nhấn mạnh",
    action: "quote",
  },
  {
    key: "code",
    label: "Code block",
    description: "Đoạn mã có syntax highlight",
    action: "code",
  },
  {
    key: "table",
    label: "Bảng",
    description: "Bảng Markdown có header",
    action: "table",
  },
  {
    key: "image",
    label: "Ảnh",
    description: "Upload ảnh vào nội dung",
    action: "image",
  },
  {
    key: "callout",
    label: "Callout",
    description: "Thông tin, lưu ý hoặc cảnh báo",
    action: "callout",
  },
  {
    key: "divider",
    label: "Divider",
    description: "Đường phân cách nội dung",
    action: "divider",
  },
];

const ACTION_META: Record<
  ToolbarAction,
  { label: string; title: string; icon?: typeof Bold }
> = {
  h1: { label: "H1", title: "Tiêu đề cấp 1" },
  h2: { label: "H2", title: "Tiêu đề cấp 2" },
  h3: { label: "H3", title: "Tiêu đề cấp 3" },
  bold: { label: "B", title: "In đậm", icon: Bold },
  italic: { label: "I", title: "In nghiêng", icon: Italic },
  strike: { label: "S", title: "Gạch ngang", icon: Strikethrough },
  link: { label: "Link", title: "Chèn liên kết", icon: Link2 },
  image: { label: "Ảnh", title: "Upload ảnh", icon: ImagePlus },
  quote: { label: "Quote", title: "Trích dẫn", icon: Quote },
  code: { label: "Code", title: "Code block", icon: Code2 },
  list: { label: "List", title: "Danh sách", icon: List },
  checklist: { label: "Check", title: "Checklist", icon: ListChecks },
  table: { label: "Table", title: "Chèn bảng", icon: Table2 },
  callout: { label: "Callout", title: "Callout thông tin/cảnh báo" },
  divider: { label: "Divider", title: "Đường phân cách", icon: Minus },
};

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function isInsideCodeBlock(value: string, cursor: number): boolean {
  const before = value.slice(0, cursor);
  return (before.match(/```/g)?.length ?? 0) % 2 === 1;
}

function getSlashState(
  value: string,
  cursor: number,
): { start: number; end: number; query: string } | null {
  const lineStart = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  const fragment = value.slice(lineStart, cursor);
  const slash = fragment.lastIndexOf("/");
  if (slash < 0) return null;
  const before = fragment.slice(0, slash);
  const query = fragment.slice(slash + 1);
  if ((before && !/\s$/.test(before)) || /\s/.test(query)) return null;
  return { start: lineStart + slash, end: cursor, query };
}

function parseUploadResponse(raw: string): {
  markdown?: string;
  originalName?: string;
  attachmentId?: string;
  error?: string;
} {
  try {
    const json = JSON.parse(raw) as {
      success?: boolean;
      data?: {
        markdown?: string;
        originalName?: string;
        attachmentId?: string;
      };
      error?: string;
    };
    return {
      ...json.data,
      error: json.success === false ? json.error : undefined,
    };
  } catch {
    return { error: "Phản hồi upload không hợp lệ." };
  }
}

export function MarkdownEditor({
  value,
  onChange,
  preset = "community-post",
  id = "markdown-editor",
  placeholder,
  maxLength = 100_000,
  minHeightClassName = "min-h-[22rem]",
  className,
  disabled = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  const [mode, setMode] = useState<EditorMode>("write");
  const [slashState, setSlashState] = useState<{
    start: number;
    end: number;
    query: string;
  } | null>(null);
  const [upload, setUpload] = useState<UploadProgress>(null);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const config = CONFIG[preset];
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const availableActions = useMemo(
    () => new Set(config.actions),
    [config.actions],
  );
  const filteredSlashCommands = useMemo(() => {
    const query = slashState?.query.toLowerCase() ?? "";
    return SLASH_COMMANDS.filter(
      (item) =>
        availableActions.has(item.action) &&
        `${item.key} ${item.label} ${item.description}`
          .toLowerCase()
          .includes(query),
    ).slice(0, 7);
  }, [availableActions, slashState]);

  const updateSlashState = (next: string, cursor: number) => {
    const nextSlash = getSlashState(next, cursor);
    setSlashState(nextSlash);
  };

  const insertText = (
    replacement: string,
    selectStart = replacement.length,
    selectEnd = replacement.length,
    range?: { start: number; end: number },
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = range?.start ?? textarea.selectionStart;
    const end = range?.end ?? textarea.selectionEnd;
    const currentValue = valueRef.current;
    const next = `${currentValue.slice(0, start)}${replacement}${currentValue.slice(end)}`;
    onChange(next.slice(0, maxLength));
    setSlashState(null);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const nextStart = Math.min(start + selectStart, next.length);
      const nextEnd = Math.min(start + selectEnd, next.length);
      textarea.setSelectionRange(nextStart, nextEnd);
    });
  };

  const applyAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const range = slashState
      ? { start: slashState.start, end: slashState.end }
      : undefined;
    const start = range?.start ?? textarea.selectionStart;
    const end = range?.end ?? textarea.selectionEnd;
    const selected = value.slice(start, end);
    const placeholderText =
      selected ||
      (action === "link"
        ? "văn bản"
        : action === "code"
          ? "const bot = true;"
          : action === "table"
            ? ""
            : "nội dung");

    if (action === "image") {
      if (range) textarea.setSelectionRange(range.start, range.end);
      fileInputRef.current?.click();
      return;
    }
    const put = (
      replacement: string,
      selectStart = replacement.length,
      selectEnd = replacement.length,
    ) => insertText(replacement, selectStart, selectEnd, range);
    if (action === "divider") {
      put(
        `${start > 0 && !value.slice(0, start).endsWith("\n") ? "\n" : ""}---\n\n`,
      );
      return;
    }
    if (action === "table") {
      put(
        "| Gói | Giá | Ghi chú |\n| --- | ---: | --- |\n| Basic | 300.000đ/tháng | 1 tài khoản |\n",
        0,
        0,
      );
      return;
    }
    if (action === "checklist") {
      put(
        selected
          ? selected
              .split(/\r?\n/)
              .map((line) => `- [ ] ${line.replace(/^[-*]\s+/, "")}`)
              .join("\n")
          : "- [ ] Việc cần làm",
        selected ? 0 : 6,
        selected ? 0 : 18,
      );
      return;
    }
    if (action === "list") {
      put(
        selected
          ? selected
              .split(/\r?\n/)
              .map((line) => `- ${line.replace(/^[-*]\s+/, "")}`)
              .join("\n")
          : "- Nội dung",
        selected ? 0 : 2,
        selected ? 0 : 10,
      );
      return;
    }
    if (action === "quote") {
      put(
        selected
          ? selected
              .split(/\r?\n/)
              .map((line) => `> ${line}`)
              .join("\n")
          : "> Nội dung cần nhấn mạnh",
        selected ? 0 : 2,
        selected ? 0 : 24,
      );
      return;
    }
    if (action === "callout") {
      const replacement = `:::info\n${selected || "Thông tin cần lưu ý"}\n:::`;
      put(replacement, selected ? 8 : 8, selected ? 8 + selected.length : 31);
      return;
    }
    if (action === "code") {
      const replacement = `\`\`\`js\n${placeholderText}\n\`\`\``;
      put(replacement, 6, 6 + placeholderText.length);
      return;
    }
    if (action === "link") {
      const url = window.prompt("URL liên kết", "https://");
      if (!url) return;
      const label = selected || "liên kết";
      put(`[${label}](${url.trim()})`, 1, 1 + label.length);
      return;
    }
    const format: Record<string, [string, string]> = {
      h1: ["# ", ""],
      h2: ["## ", ""],
      h3: ["### ", ""],
      bold: ["**", "**"],
      italic: ["*", "*"],
      strike: ["~~", "~~"],
    };
    const [before, after] = format[action] ?? ["", ""];
    put(
      `${before}${placeholderText}${after}`,
      before.length,
      before.length + placeholderText.length,
    );
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/"))
      throw new Error("Chỉ nhận file hình ảnh.");
    if (file.size > 10 * 1024 * 1024)
      throw new Error("Ảnh phải nhỏ hơn 10 MB.");
    const body = new FormData();
    body.append("file", file);
    body.append("usage", config.usage);
    setUpload({ filename: file.name, progress: 0 });

    try {
      // XHR is retained for upload progress, but the request is first passed
      // through the same TSP capability/signature preparation as fetch().
      const prepared = await secureRequest("/api/uploads/images", {
        method: "POST",
        credentials: "include",
        body,
      });
      const target = prepared.input instanceof URL
        ? prepared.input.toString()
        : typeof prepared.input === "string"
          ? prepared.input
          : prepared.input.url;
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", target);
        request.withCredentials = true;
        request.timeout = 60_000;
        request.responseType = "arraybuffer";
        if (prepared.init.headers instanceof Headers) {
          prepared.init.headers.forEach((value, key) => request.setRequestHeader(key, value));
        }
      request.upload.onprogress = (event) => {
        if (event.lengthComputable)
          setUpload({
            filename: file.name,
            progress: Math.round((event.loaded / event.total) * 100),
          });
      };
      request.onerror = () =>
        reject(new Error("Không thể kết nối tới máy chủ upload."));
      request.ontimeout = () =>
        reject(new Error("Upload ảnh quá lâu và đã hết thời gian chờ."));
      request.onabort = () => reject(new Error("Upload ảnh đã bị hủy."));
      request.onload = () => {
        void (async () => {
          const responseHeaders = new Headers();
          const transportMarker = request.getResponseHeader("X-TB-Transport");
          const contentType = request.getResponseHeader("Content-Type");
          const transportContentType = request.getResponseHeader("X-TB-Transport-Content-Type");
          const contentDisposition = request.getResponseHeader("Content-Disposition");
          if (transportMarker) responseHeaders.set("X-TB-Transport", transportMarker);
          if (contentType) responseHeaders.set("Content-Type", contentType);
          if (transportContentType) responseHeaders.set("X-TB-Transport-Content-Type", transportContentType);
          if (contentDisposition) responseHeaders.set("Content-Disposition", contentDisposition);
          const requestHeaders = new Headers(prepared.init.headers);
          const sequenceValue = requestHeaders.get("X-TB-Transport-Sequence");
          const decoded = await decryptTransportResponse(
            new Response(request.response as ArrayBuffer, {
              status: request.status,
              statusText: request.statusText,
              headers: responseHeaders,
            }),
            {
              requestId: requestHeaders.get("X-TB-Transport-Request") ?? undefined,
              sequence: sequenceValue && /^\d+$/.test(sequenceValue) ? Number(sequenceValue) : undefined,
            },
          );
          const result = parseUploadResponse(await decoded.text());
        if (request.status < 200 || request.status >= 300 || !result.markdown) {
          reject(new Error(result.error || "Upload ảnh thất bại."));
          return;
        }
        const currentValue = valueRef.current;
        insertText(
          `${currentValue && !currentValue.endsWith("\n") ? "\n" : ""}${result.markdown}\n`,
          0,
          0,
        );
          resolve();
        })().catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error("Upload áº£nh tháº¥t báº¡i."));
        });
      };
        request.send(prepared.init.body as XMLHttpRequestBodyInit);
      });
    } finally {
      setUpload(null);
    }
  };

  const uploadImages = async (files: File[]) => {
    for (const file of files.slice(0, 5)) {
      try {
        await uploadImage(file);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload ảnh thất bại.",
        );
      }
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void uploadImages(files);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length) void uploadImages(files);
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!files.length) return;
    event.preventDefault();
    void uploadImages(files);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const meta = event.ctrlKey || event.metaKey;
    if (slashState && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      return;
    }
    if (slashState && event.key === "Enter" && filteredSlashCommands[0]) {
      event.preventDefault();
      applyAction(filteredSlashCommands[0].action);
      return;
    }
    if (slashState && event.key === "Escape") {
      event.preventDefault();
      setSlashState(null);
      return;
    }
    if (meta && event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyAction("bold");
      return;
    }
    if (meta && event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyAction("italic");
      return;
    }
    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      applyAction("link");
      return;
    }
    if (meta && event.key === "Enter") {
      event.preventDefault();
      setMode((current) => (current === "preview" ? "write" : "preview"));
      return;
    }
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (event.shiftKey) {
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const remove =
        value.slice(lineStart, lineStart + 2) === "  "
          ? 2
          : value.slice(lineStart, lineStart + 1) === "\t"
            ? 1
            : 0;
      if (remove)
        insertText("", 0, 0, { start: lineStart, end: lineStart + remove });
      return;
    }
    insertText(isInsideCodeBlock(value, start) ? "  " : "  ", 0, 0);
  };

  const onChangeText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value.slice(0, maxLength);
    onChange(next);
    updateSlashState(next, event.target.selectionStart);
  };

  const editorBody = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-background transition-colors focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/15",
        dragging && "border-brand bg-brand/[0.04]",
        disabled && "opacity-60",
        className,
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/95 px-2 py-2 backdrop-blur"
        aria-label="Thanh công cụ Markdown"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-0.5">
          {config.actions.map((action, index) => {
            const item = ACTION_META[action];
            const Icon = item.icon;
            const divider =
              index > 0 &&
              ["bold", "link", "quote", "list", "callout"].includes(action);
            return (
              <span key={action} className="inline-flex items-center">
                {divider ? (
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                ) : null}
                <button
                  type="button"
                  disabled={disabled || (action === "image" && Boolean(upload))}
                  onClick={() => applyAction(action)}
                  title={item.title}
                  aria-label={item.title}
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
                >
                  {Icon ? (
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    item.label
                  )}
                </button>
              </span>
            );
          })}
        </div>
        <div
          className="flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-0.5"
          role="tablist"
          aria-label="Chế độ Markdown"
        >
          {(
            [
              ["write", "Viết", Pencil],
              ["split", "Chia đôi", Columns2],
              ["preview", "Xem trước", Eye],
            ] as const
          ).map(([target, label, Icon]) => (
            <button
              key={target}
              type="button"
              role="tab"
              aria-selected={mode === target}
              onClick={() => setMode(target)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                mode === target
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFullscreen((current) => !current)}
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            title={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {upload ? (
        <div
          className="flex items-center gap-3 border-b border-border bg-brand/[0.06] px-3 py-2 text-xs"
          role="status"
        >
          <UploadCloud className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{upload.filename}</span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-brand/15">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${upload.progress}%` }}
            />
          </div>
          <span className="w-8 text-right tabular-nums text-muted-foreground">
            {upload.progress}%
          </span>
        </div>
      ) : null}

      {mode === "write" || mode === "split" ? (
        <div
          className={cn(
            "grid",
            mode === "split" ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          <div className={cn(mode === "split" && "border-r border-border")}>
            <textarea
              ref={textareaRef}
              id={id}
              value={value}
              onChange={onChangeText}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              disabled={disabled}
              maxLength={maxLength}
              placeholder={placeholder ?? config.placeholder}
              spellCheck
              className={cn(
                "block w-full resize-y bg-transparent px-4 py-4 font-mono text-[13px] leading-7 text-foreground outline-none placeholder:text-muted-foreground",
                minHeightClassName,
              )}
              aria-label="Nội dung Markdown"
            />
            {slashState && filteredSlashCommands.length ? (
              <div
                className="absolute left-3 right-3 top-[4.4rem] z-30 max-w-sm rounded-xl border border-border bg-card p-1.5 shadow-xl"
                role="listbox"
                aria-label="Lệnh Markdown"
              >
                <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Chèn nhanh
                </p>
                {filteredSlashCommands.map((command) => (
                  <button
                    key={command.key}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyAction(command.action)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="text-xs font-semibold text-foreground">
                      {command.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {command.description}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {mode === "split" ? (
            <div className="max-h-[38rem] overflow-y-auto bg-card px-4 py-4 sm:px-6">
              <MarkdownRenderer
                value={value}
                emptyLabel="Preview sẽ hiển thị ở đây."
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "max-h-[48rem] overflow-y-auto bg-card px-4 py-5 sm:px-7",
            minHeightClassName,
          )}
        >
          <MarkdownRenderer
            value={value}
            emptyLabel="Preview sẽ hiển thị ở đây."
          />
        </div>
      )}

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/85 p-6 text-center backdrop-blur-sm">
          <div>
            <UploadCloud className="mx-auto h-8 w-8 text-brand" aria-hidden />
            <p className="mt-2 text-sm font-semibold">
              Thả ảnh để upload vào bài
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, GIF hoặc WEBP · tối đa 10 MB
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <span>
          {wordCount(value).toLocaleString("vi-VN")} từ ·{" "}
          {Math.max(1, Math.ceil(wordCount(value) / 180))} phút đọc
        </span>
        <span>
          {value.length.toLocaleString("vi-VN")}/
          {maxLength.toLocaleString("vi-VN")} ký tự
        </span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={onFileChange}
        aria-label="Chọn ảnh để upload"
      />
    </div>
  );

  if (!fullscreen) return editorBody;
  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-background p-3 sm:p-6">
      <div className="mx-auto min-h-full max-w-6xl">
        {editorBody}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> Xong
          </button>
        </div>
      </div>
    </div>
  );
}
