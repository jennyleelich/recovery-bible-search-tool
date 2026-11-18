# recovery-bible-search-tool
recovery bible multiple advance search tool

Read each Recovery Version verse in Simplified Chinese with its matching English text directly underneath.

## Run locally

Requires Python 3.9 or newer and an internet connection. No packages to install.

```sh
python3 server.py
```

Open http://127.0.0.1:8000. On Windows, use `py server.py` if `python3` is unavailable.

Choose 圣别 (Holiness), 长子名分 (Birthright), 恩典 (Grace), or 国度 (Kingdom), or paste a batch such as `利十九2；来二11、十10；John 1:16–17`. If port 8000 is busy, run `python3 server.py --port 8001`.

After a lookup, choose **Download TXT · 下载文本** to save all displayed verses in a single UTF-8 text file. Each reference is followed by its Simplified Chinese and English text.

The app requests verse text at lookup time from Taiwan Gospel Book Room (Simplified Chinese Recovery Version) and Living Stream Ministry (English Recovery Version). Translation rights belong to the respective publishers.
