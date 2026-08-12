import json
import os
import difflib
import tkinter as tk
from datetime import datetime
from tkinter import messagebox

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")


def load_config():
    default = {"inbox": os.path.join(os.path.expanduser("~"), "Documents", "收件箱")}
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
        merged = dict(default)
        merged.update(cfg)
        return merged
    except Exception:
        return default


def normalized(text):
    return "".join(text.split()).lower()


def similarity(a, b):
    na, nb = normalized(a), normalized(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return max(len(na), len(nb)) / min(len(na), len(nb)) * 0.5 + 0.5
    return difflib.SequenceMatcher(None, na, nb).ratio()


def main():
    root = tk.Tk()
    root.withdraw()

    try:
        text = root.clipboard_get()
    except Exception:
        messagebox.showerror("保存 Markdown", "剪贴板里没有文本。\n请先复制要保存的内容，再点这个图标。")
        root.destroy()
        return

    if not text.strip():
        messagebox.showerror("保存 Markdown", "剪贴板内容是空的。")
        root.destroy()
        return

    cfg = load_config()
    inbox = cfg["inbox"]
    os.makedirs(inbox, exist_ok=True)

    best_name = None
    best_score = 0.0
    for fname in os.listdir(inbox):
        if not fname.lower().endswith(".md"):
            continue
        path = os.path.join(inbox, fname)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue
        score = similarity(text, content)
        if score > best_score:
            best_score = score
            best_name = fname

    ts = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    target = None

    if best_name and best_score >= 0.8:
        choice = messagebox.askyesnocancel(
            "发现相似文档",
            "剪贴板内容和《%s》很像（相似度 %.0f%%）。\n\n"
            "是   → 更新到那篇里（旧内容自动留底为历史版本）\n"
            "否   → 另存为新文档\n"
            "取消 → 放弃保存" % (best_name, best_score * 100),
        )
        if choice is None:
            root.destroy()
            return
        if choice:
            target = os.path.join(inbox, best_name)
            base = best_name[:-3] if best_name.lower().endswith(".md") else best_name
            ver_dir = os.path.join(inbox, ".versions", base)
            os.makedirs(ver_dir, exist_ok=True)
            try:
                with open(target, encoding="utf-8", errors="ignore") as f:
                    old = f.read()
                with open(os.path.join(ver_dir, ts + ".md"), "w", encoding="utf-8") as f:
                    f.write(old)
            except Exception:
                pass
            with open(target, "w", encoding="utf-8") as f:
                f.write(text)
        else:
            target = os.path.join(inbox, ts + ".md")
            with open(target, "w", encoding="utf-8") as f:
                f.write(text)
    else:
        target = os.path.join(inbox, ts + ".md")
        with open(target, "w", encoding="utf-8") as f:
            f.write(text)

    root.destroy()
    if target:
        messagebox.showinfo("已保存", "已存入收件箱：\n%s" % target)


if __name__ == "__main__":
    main()
