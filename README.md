# ESign Source Decoder

Static HTML/JavaScript utility for decoding and encoding ESign encrypted app source share strings.

Deployed at: https://devnoname120.github.io/esign-source-decoder/

ESign source shares use this format:

```text
source[base64(RC4("source_share", plaintext_urls))]
```

Open `index.html` locally or use the GitHub Pages deployment. Paste an encrypted `source[...]` value into the left box to decode it, or paste plaintext URL lines into the right box to encode them.

## Development

```sh
npm test
```
