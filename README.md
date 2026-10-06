# pear

Installer for the [Pear Runtime](https://github.com/holepunchto/pear).

## Install

```
npx pear
```

Installs the `pear` CLI to `~/.local/bin` (Windows: `%LOCALAPPDATA%\Programs`) and adds it to your `PATH`. Open a new terminal afterwards, then run `pear help [cmd]`.

Node is only needed to install. Once `pear` is installed, `npx pear` forwards to it.

Linux needs `libatomic` (Debian/Ubuntu: `sudo apt install libatomic1`).

## Docs

- [Getting started](https://docs.pears.com/pear/getting-started/)
- [Other install methods](https://docs.pears.com/pear/getting-started/#install-pear)
- [CLI reference](https://docs.pears.com/pear/reference/pear/cli/)
- [API reference](https://docs.pears.com/pear/reference/pear/api/)
- [Troubleshooting](https://docs.pears.com/pear/how-to/troubleshooting/)

## 0.x.x line

The `pear` npm name was kindly donated by [Nicolas Herment](https://github.com/nherment), who wrote `pear@0.x.x` as an in-memory cache.

## License

Apache-2.0
