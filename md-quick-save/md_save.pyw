import tkinter as tk
from tkinter import filedialog, messagebox
from datetime import datetime

root = tk.Tk()
root.withdraw()

try:
    text = root.clipboard_get()
except Exception:
    messagebox.showerror("保存 Markdown", "剪贴板里没有文本。\n请先复制要保存的内容，再点这个图标。")
    root.destroy()
    raise SystemExit(1)

if not text.strip():
    messagebox.showerror("保存 Markdown", "剪贴板内容是空的。")
    root.destroy()
    raise SystemExit(1)

default_name = datetime.now().strftime("%Y-%m-%d-%H%M") + ".md"
path = filedialog.asksaveasfilename(
    title="保存 Markdown",
    defaultextension=".md",
    filetypes=[("Markdown 文件", "*.md"), ("文本文件", "*.txt"), ("所有文件", "*.*")],
    initialfile=default_name,
)

if not path:
    root.destroy()
    raise SystemExit(0)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

root.destroy()
