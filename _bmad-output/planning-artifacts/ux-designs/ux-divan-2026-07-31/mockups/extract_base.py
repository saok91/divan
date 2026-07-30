import pathlib
import re

here = pathlib.Path(__file__).parent
src = (here / "direction-a-dense-console.html").read_text(encoding="utf-8")

style = re.search(r"<style>.*?</style>", src, re.S).group(0)
sprite = re.search(r"<svg width=.0. height=.0.*?</svg>", src, re.S).group(0)

out = here / "_dense-console-base.html"
out.write_text(style + "\n\n" + sprite + "\n", encoding="utf-8")
print("style lines", style.count("\n"), "sprite lines", sprite.count("\n"), "bytes", out.stat().st_size)
