const assert = require("node:assert/strict");
const test = require("node:test");

const {
  decodeSource,
  encodeSource,
  extractPayload,
  extractUrls,
} = require("./esign-source-decoder.js");

const sampleInput =
  "source[5GHxhb1U7Lcumpoh+isTdMmoc0QK0KQbTrbwg3Of0OJxMU2IBClgoTe7IHs29auwL8s56IbQwtyXMEjGJ2pO1SdXii7bZ/+Jgs5G8KckEFqQvJEktFYUnUvqHgvOsw==]";

const samplePayload =
  "5GHxhb1U7Lcumpoh+isTdMmoc0QK0KQbTrbwg3Of0OJxMU2IBClgoTe7IHs29auwL8s56IbQwtyXMEjGJ2pO1SdXii7bZ/+Jgs5G8KckEFqQvJEktFYUnUvqHgvOsw==";

const samplePlaintext =
  "https://repo.example/app.json\nhttp://mirror.example/source.json\nhttps://repo.example/app.json\n";

test("extractPayload accepts source wrapper and removes whitespace", () => {
  assert.equal(extractPayload(` source[\n${samplePayload.slice(0, 20)}\n${samplePayload.slice(20)}\n] `), samplePayload);
});

test("decodeSource matches the Python RC4 source_share vector", () => {
  assert.equal(decodeSource(sampleInput), samplePlaintext);
  assert.equal(decodeSource(samplePayload), samplePlaintext);
});

test("encodeSource matches the Python RC4 source_share vector", () => {
  assert.equal(encodeSource(samplePlaintext), sampleInput);
  assert.equal(decodeSource(encodeSource(samplePlaintext)), samplePlaintext);
});

test("extractUrls returns unique HTTP URLs in order", () => {
  assert.deepEqual(extractUrls(samplePlaintext), [
    "https://repo.example/app.json",
    "http://mirror.example/source.json",
  ]);
});

test("decodeSource rejects invalid base64 payloads", () => {
  assert.throws(() => decodeSource("source[not base64]"), /invalid base64/i);
});

function setupPage() {
  const fs = require("node:fs");
  const vm = require("node:vm");

  function makeElement(id) {
    return {
      id,
      value: "",
      textContent: "",
      handlers: {},
      classList: { toggle() {} },
      addEventListener(type, handler) {
        this.handlers[type] = handler;
      },
      focus() {},
      select() {},
    };
  }

  const elements = Object.fromEntries([
    "source-input",
    "key-input",
    "output",
    "status",
    "decode-button",
    "copy-button",
    "clear-button",
  ].map((id) => [id, makeElement(id)]));

  elements["key-input"].value = "source_share";

  const context = {
    TextDecoder,
    TextEncoder,
    atob,
    btoa,
    console,
    document: {
      getElementById(id) {
        if (!elements[id]) throw new Error(`missing element ${id}`);
        return elements[id];
      },
      execCommand() {
        return true;
      },
    },
    navigator: {},
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("esign-source-decoder.js", "utf8"), context);

  const html = fs.readFileSync("index.html", "utf8");
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  vm.runInContext(inlineScripts.join("\n"), context);

  function paste(id, text) {
    let prevented = false;
    elements[id].handlers.paste({
      preventDefault() {
        prevented = true;
      },
      clipboardData: {
        getData() {
          return text;
        },
      },
    });
    assert.equal(prevented, true);
  }

  return { elements, paste };
}

test("pasting encrypted source into the left box decodes automatically", () => {
  const page = setupPage();

  page.paste("source-input", sampleInput);

  assert.equal(page.elements["source-input"].value, sampleInput);
  assert.equal(page.elements.output.value, "https://repo.example/app.json\nhttp://mirror.example/source.json");
  assert.equal(page.elements.status.textContent, "2 URLs");
});

test("pasting plaintext URLs into the right box encodes automatically", () => {
  const page = setupPage();

  page.paste("output", samplePlaintext);

  assert.equal(page.elements.output.value, samplePlaintext);
  assert.equal(page.elements["source-input"].value, sampleInput);
  assert.equal(page.elements.status.textContent, "Encoded source");
});
