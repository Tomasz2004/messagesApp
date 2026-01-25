/**
 * CryptoService - Web Crypto API implementation for E2EE
 * Zgodny z backendem używającym RSA-2048 i AES-256-GCM
 */

class CryptoService {
  /**
   * Generuje parę kluczy RSA-2048
   */
  async generateRSAKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt'],
    );

    return keyPair;
  }

  /**
   * Eksportuje klucz publiczny do formatu PEM
   */
  async exportPublicKey(publicKey) {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    const exportedAsString = String.fromCharCode.apply(
      null,
      new Uint8Array(exported),
    );
    const exportedAsBase64 = window.btoa(exportedAsString);
    return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Eksportuje klucz prywatny do formatu PEM
   */
  async exportPrivateKey(privateKey) {
    const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
    const exportedAsString = String.fromCharCode.apply(
      null,
      new Uint8Array(exported),
    );
    const exportedAsBase64 = window.btoa(exportedAsString);
    return `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`;
  }

  /**
   * Importuje klucz publiczny z formatu PEM
   */
  async importPublicKey(pemKey) {
    try {
      // Usuń możliwe białe znaki na początku/końcu
      let trimmedKey = pemKey.trim();

      const pemHeader = '-----BEGIN PUBLIC KEY-----';
      const pemFooter = '-----END PUBLIC KEY-----';

      // Jeśli klucz nie ma nagłówków PEM, dodaj je
      if (!trimmedKey.includes(pemHeader)) {
        // Backend zwraca sam Base64 bez nagłówków - dodaj je
        trimmedKey = `${pemHeader}\n${trimmedKey}\n${pemFooter}`;
      }

      const pemContents = trimmedKey.substring(
        trimmedKey.indexOf(pemHeader) + pemHeader.length,
        trimmedKey.indexOf(pemFooter),
      );

      const binaryDerString = window.atob(pemContents.replace(/\s/g, ''));
      const binaryDer = new Uint8Array(
        [...binaryDerString].map((char) => char.charCodeAt(0)),
      );

      return await window.crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256',
        },
        true,
        ['encrypt'],
      );
    } catch (error) {
      console.error('Error importing public key:', error);
      console.error('PEM Key length:', pemKey?.length);
      console.error('PEM Key preview:', pemKey?.substring(0, 100));
      throw error;
    }
  }

  /**
   * Importuje klucz prywatny z formatu PEM
   */
  async importPrivateKey(pemKey) {
    let trimmedKey = pemKey.trim();

    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';

    // Jeśli klucz nie ma nagłówków PEM, dodaj je
    if (!trimmedKey.includes(pemHeader)) {
      trimmedKey = `${pemHeader}\n${trimmedKey}\n${pemFooter}`;
    }

    const pemContents = trimmedKey.substring(
      trimmedKey.indexOf(pemHeader) + pemHeader.length,
      trimmedKey.indexOf(pemFooter),
    );
    const binaryDerString = window.atob(pemContents.replace(/\s/g, ''));
    const binaryDer = new Uint8Array(
      [...binaryDerString].map((char) => char.charCodeAt(0)),
    );

    return await window.crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt'],
    );
  }

  /**
   * Generuje klucz AES-256 z hasła (PBKDF2)
   */
  async deriveKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey'],
    );

    const saltBuffer = this.base64ToArrayBuffer(salt);

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Szyfrowanie AES-256-GCM
   */
  async encryptWithAES(plaintext, key, iv) {
    const enc = new TextEncoder();
    const encoded = enc.encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encoded,
    );

    return new Uint8Array(ciphertext);
  }

  /**
   * Deszyfrowanie AES-256-GCM
   */
  async decryptWithAES(ciphertext, key, iv) {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext,
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  /**
   * Szyfrowanie RSA-OAEP
   */
  async encryptWithRSA(plaintext, publicKey) {
    const enc = new TextEncoder();
    const encoded = enc.encode(plaintext);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      encoded,
    );

    return new Uint8Array(encrypted);
  }

  /**
   * Szyfrowanie RSA-OAEP dla binarnych danych (np. klucz AES)
   */
  async encryptBytesWithRSA(bytes, publicKey) {
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
      },
      publicKey,
      bytes,
    );

    return new Uint8Array(encrypted);
  }

  /**
   * Deszyfrowanie RSA-OAEP
   */
  async decryptWithRSA(ciphertext, privateKey) {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      ciphertext,
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  /**
   * Deszyfrowanie RSA-OAEP dla binarnych danych (np. klucz AES)
   */
  async decryptBytesWithRSA(ciphertext, privateKey) {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      ciphertext,
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Generuje losowy IV (12 bajtów dla GCM)
   */
  generateIV() {
    return window.crypto.getRandomValues(new Uint8Array(12));
  }

  /**
   * Generuje losowy klucz AES-256
   */
  async generateAESKey() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Eksportuje klucz AES do raw bytes
   */
  async exportAESKey(key) {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return new Uint8Array(exported);
  }

  /**
   * Importuje klucz AES z raw bytes
   */
  async importAESKey(keyData) {
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt'],
    );
  }

  /**
   * Konwersja ArrayBuffer do Base64
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Konwersja Base64 do ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Deszyfrowanie klucza prywatnego RSA użytkownika
   * (zaszyfrowanego kluczem derywowanym z hasła)
   */
  async decryptPrivateKey(encryptedPrivateKey, password, keyDerivationSalt) {
    // Format: "ciphertext:iv" (jak w backendzie)
    const [ciphertextBase64, ivBase64] = encryptedPrivateKey.split(':');

    // Derywuj klucz z hasła
    const derivedKey = await this.deriveKeyFromPassword(
      password,
      keyDerivationSalt,
    );

    // Odszyfruj
    const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
    const iv = this.base64ToArrayBuffer(ivBase64);

    const privateKeyPEM = await this.decryptWithAES(
      ciphertext,
      derivedKey,
      new Uint8Array(iv),
    );

    return privateKeyPEM;
  }

  /**
   * Importuje klucz prywatny do formatu do podpisywania (RSASSA-PKCS1-v1_5)
   */
  async importPrivateKeyForSigning(pemKey) {
    let trimmedKey = pemKey.trim();

    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';

    if (!trimmedKey.includes(pemHeader)) {
      trimmedKey = `${pemHeader}\n${trimmedKey}\n${pemFooter}`;
    }

    const pemContents = trimmedKey.substring(
      trimmedKey.indexOf(pemHeader) + pemHeader.length,
      trimmedKey.indexOf(pemFooter),
    );
    const binaryDerString = window.atob(pemContents.replace(/\s/g, ''));
    const binaryDer = new Uint8Array(
      [...binaryDerString].map((char) => char.charCodeAt(0)),
    );

    return await window.crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign'],
    );
  }

  /**
   * Tworzy hash SHA-256 z danych wiadomości
   * Hashuje konkatenację: subjectEncrypted + contentEncrypted
   */
  async createMessageHash(subjectEncrypted, contentEncrypted) {
    // Konkatenuj dane do zahashowania
    let dataToHash = '';

    if (subjectEncrypted) {
      dataToHash += this.arrayBufferToBase64(subjectEncrypted);
    }
    dataToHash += this.arrayBufferToBase64(contentEncrypted);

    // Zakoduj do bajtów
    const encoder = new TextEncoder();
    const data = encoder.encode(dataToHash);

    // Utwórz hash SHA-256
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

    return new Uint8Array(hashBuffer);
  }

  /**
   * Podpisuje hash wiadomości kluczem prywatnym nadawcy
   * Zwraca podpis cyfrowy (signature)
   */
  async signMessageHash(hash, privateKey) {
    const signature = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      hash,
    );

    return new Uint8Array(signature);
  }

  /**
   * Importuje klucz publiczny do weryfikacji podpisu
   */
  async importPublicKeyForVerifying(pemKey) {
    try {
      let trimmedKey = pemKey.trim();

      const pemHeader = '-----BEGIN PUBLIC KEY-----';
      const pemFooter = '-----END PUBLIC KEY-----';

      if (!trimmedKey.includes(pemHeader)) {
        trimmedKey = `${pemHeader}\n${trimmedKey}\n${pemFooter}`;
      }

      const pemContents = trimmedKey.substring(
        trimmedKey.indexOf(pemHeader) + pemHeader.length,
        trimmedKey.indexOf(pemFooter),
      );

      const binaryDerString = window.atob(pemContents.replace(/\s/g, ''));
      const binaryDer = new Uint8Array(
        [...binaryDerString].map((char) => char.charCodeAt(0)),
      );

      return await window.crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        true,
        ['verify'],
      );
    } catch (error) {
      console.error('Error importing public key for verification:', error);
      throw error;
    }
  }

  /**
   * Weryfikuje podpis cyfrowy wiadomości
   */
  async verifySignature(signature, hash, publicKey) {
    try {
      const isValid = await window.crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        publicKey,
        signature,
        hash,
      );

      return isValid;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
}

export default new CryptoService();
