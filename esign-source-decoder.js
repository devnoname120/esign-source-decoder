(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ESignSourceDecoder = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_KEY = "source_share";
  var SOURCE_RE = /source\[([\s\S]*?)\]/i;
  var URL_RE = /https?:\/\/[^\s<>'"\\\])]+/g;
  var BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  function textToBytes(value) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(value);
    }
    return Uint8Array.from(Buffer.from(value, "utf8"));
  }

  function bytesToText(value) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: true }).decode(value);
    }
    return Buffer.from(value).toString("utf8");
  }

  function bytesToBase64(value) {
    if (typeof btoa === "function") {
      var binary = "";
      for (var i = 0; i < value.length; i += 1) {
        binary += String.fromCharCode(value[i]);
      }
      return btoa(binary);
    }
    return Buffer.from(value).toString("base64");
  }

  function extractPayload(text) {
    var value = String(text == null ? "" : text);
    var match = SOURCE_RE.exec(value);
    var payload = (match ? match[1] : value).replace(/\s+/g, "");

    if (!payload) {
      throw new Error("empty encrypted source payload");
    }
    return payload;
  }

  function decodeBase64(payload) {
    if (payload.length % 4 !== 0 || !BASE64_RE.test(payload)) {
      throw new Error("invalid base64 source payload");
    }

    if (typeof atob === "function") {
      try {
        var binary = atob(payload);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i) & 0xff;
        }
        return bytes;
      } catch (error) {
        throw new Error("invalid base64 source payload");
      }
    }

    return Uint8Array.from(Buffer.from(payload, "base64"));
  }

  function rc4Crypt(keyBytes, dataBytes) {
    if (!keyBytes.length) {
      throw new Error("RC4 key must not be empty");
    }

    var state = new Uint8Array(256);
    var i;
    var j = 0;

    for (i = 0; i < 256; i += 1) {
      state[i] = i;
    }

    for (i = 0; i < 256; i += 1) {
      j = (j + state[i] + keyBytes[i % keyBytes.length]) & 0xff;
      var swap = state[i];
      state[i] = state[j];
      state[j] = swap;
    }

    var output = new Uint8Array(dataBytes.length);
    i = 0;
    j = 0;

    for (var index = 0; index < dataBytes.length; index += 1) {
      i = (i + 1) & 0xff;
      j = (j + state[i]) & 0xff;
      var streamSwap = state[i];
      state[i] = state[j];
      state[j] = streamSwap;
      var streamByte = state[(state[i] + state[j]) & 0xff];
      output[index] = dataBytes[index] ^ streamByte;
    }

    return output;
  }

  function decodeSource(text, key) {
    var payload = extractPayload(text);
    var encrypted = decodeBase64(payload);
    var decrypted = rc4Crypt(textToBytes(key || DEFAULT_KEY), encrypted);

    try {
      return bytesToText(decrypted);
    } catch (error) {
      throw new Error("decrypted payload is not valid UTF-8");
    }
  }

  function encodeSource(plaintext, key) {
    var encrypted = rc4Crypt(textToBytes(key || DEFAULT_KEY), textToBytes(String(plaintext == null ? "" : plaintext)));
    return "source[" + bytesToBase64(encrypted) + "]";
  }

  function extractUrls(plaintext) {
    var urls = [];
    var seen = {};
    var match;

    URL_RE.lastIndex = 0;
    while ((match = URL_RE.exec(String(plaintext || ""))) !== null) {
      var url = match[0].replace(/[.,;:]+$/, "");
      if (!seen[url]) {
        urls.push(url);
        seen[url] = true;
      }
    }

    return urls;
  }

  return {
    DEFAULT_KEY: DEFAULT_KEY,
    decodeSource: decodeSource,
    encodeSource: encodeSource,
    extractPayload: extractPayload,
    extractUrls: extractUrls,
    rc4Crypt: rc4Crypt,
  };
});
