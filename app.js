/**
 * Rewardzen Landing Page — Pure Vanilla JavaScript
 * Zero React, Zero Node runtime dependencies.
 */

(function () {
  'use strict';

  /* =========================================================================
   * 1. ZERO-DEPENDENCY PURE JS QR CODE ENCODER (Byte mode, EC Level H)
   *    Generates crisp high-error-correction QR matrices onto HTML5 Canvas
   *    so the center Rewardzen logo overlay always scans reliably.
   * ========================================================================= */
  const PureQR = (function () {
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
    for (let i = 8; i < 256; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

    function glog(n) {
      if (n < 1) throw new Error('glog(' + n + ')');
      return LOG_TABLE[n];
    }

    function gexp(n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return EXP_TABLE[n];
    }

    function Poly(num, shift) {
      let offset = 0;
      while (offset < num.length && num[offset] === 0) offset++;
      this.num = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i++) {
        this.num[i] = num[i + offset];
      }
      for (let i = num.length - offset; i < this.num.length; i++) {
        this.num[i] = 0;
      }
    }

    Poly.prototype.get = function (index) {
      return this.num[index];
    };

    Poly.prototype.getLength = function () {
      return this.num.length;
    };

    Poly.prototype.multiply = function (e) {
      const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
        }
      }
      return new Poly(num, 0);
    };

    Poly.prototype.mod = function (e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = glog(this.get(0)) - glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= gexp(glog(e.get(i)) + ratio);
      }
      return new Poly(num, 0).mod(e);
    };

    function getErrorCorrectPolynomial(ecLength) {
      let a = new Poly([1], 0);
      for (let i = 0; i < ecLength; i++) {
        a = a.multiply(new Poly([1, gexp(i)], 0));
      }
      return a;
    }

    const PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70]
    ];

    // RS Block configurations for EC Level H (value = 2)
    // Format: [count, totalCount, dataCount, ...]
    const RS_BLOCK_TABLE_H = [
      [1, 26, 9],
      [1, 44, 16],
      [2, 35, 13],
      [4, 25, 9],
      [2, 33, 11, 2, 34, 12],
      [4, 43, 15],
      [4, 39, 13, 1, 40, 14],
      [4, 40, 14, 2, 41, 15],
      [4, 36, 12, 4, 37, 13],
      [6, 43, 15, 2, 44, 16],
      [3, 36, 12, 8, 37, 13],
      [7, 42, 14, 4, 43, 15],
      [12, 33, 11, 4, 34, 12],
      [11, 36, 12, 5, 37, 13]
    ];

    function getRSBlocksH(typeNumber) {
      const row = RS_BLOCK_TABLE_H[typeNumber - 1];
      const list = [];
      for (let i = 0; i < row.length; i += 3) {
        const count = row[i];
        const totalCount = row[i + 1];
        const dataCount = row[i + 2];
        for (let j = 0; j < count; j++) {
          list.push({ totalCount, dataCount });
        }
      }
      return list;
    }

    function getBCHTypeInfo(data) {
      let d = data << 10;
      const g = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
      while (getBCHDigit(d) - getBCHDigit(g) >= 0) {
        d ^= g << (getBCHDigit(d) - getBCHDigit(g));
      }
      return ((data << 10) | d) ^ ((1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1));
    }

    function getBCHTypeNumber(data) {
      let d = data << 12;
      const g = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | 1;
      while (getBCHDigit(d) - getBCHDigit(g) >= 0) {
        d ^= g << (getBCHDigit(d) - getBCHDigit(g));
      }
      return (data << 12) | d;
    }

    function getBCHDigit(data) {
      let digit = 0;
      while (data !== 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    }

    function getMask(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 === 0;
        case 1: return i % 2 === 0;
        case 2: return j % 3 === 0;
        case 3: return (i + j) % 3 === 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
        case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
        case 7: return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
        default: return false;
      }
    }

    function BitBuffer() {
      this.buffer = [];
      this.length = 0;
    }

    BitBuffer.prototype.put = function (num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    };

    BitBuffer.prototype.putBit = function (bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
      this.length++;
    };

    function createBytes(bytes, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);

      for (let r = 0; r < rsBlocks.length; r++) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i++) {
          dcdata[r][i] = 0xff & bytes[i + offset];
        }
        offset += dcCount;

        const rsPoly = getErrorCorrectPolynomial(ecCount);
        const rawPoly = new Poly(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i++) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
        }
      }

      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;

      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < dcdata[r].length) data[index++] = dcdata[r][i];
        }
      }
      for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < ecdata[r].length) data[index++] = ecdata[r][i];
        }
      }
      return data;
    }

    function encodeBytes(text) {
      const utf8 = new TextEncoder().encode(text);
      let typeNumber = 1;
      for (; typeNumber <= 14; typeNumber++) {
        const rsBlocks = getRSBlocksH(typeNumber);
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        const lengthBits = typeNumber < 10 ? 8 : 16;
        const requiredBits = 4 + lengthBits + utf8.length * 8;
        if (requiredBits <= totalDataCount * 8) break;
      }

      const rsBlocks = getRSBlocksH(typeNumber);
      const buffer = new BitBuffer();
      buffer.put(4, 4); // 8-bit byte mode
      buffer.put(utf8.length, typeNumber < 10 ? 8 : 16);
      for (let i = 0; i < utf8.length; i++) buffer.put(utf8[i], 8);

      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;

      if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
      while (buffer.length % 8 !== 0) buffer.putBit(false);
      while (true) {
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0xec, 8);
        if (buffer.length >= totalDataCount * 8) break;
        buffer.put(0x11, 8);
      }

      const data = createBytes(buffer.buffer, rsBlocks);
      const moduleCount = typeNumber * 4 + 17;

      function buildMatrix(maskPattern, test) {
        const modules = Array.from({ length: moduleCount }, () => new Array(moduleCount).fill(null));

        function setupPositionProbe(row, col) {
          for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
              if (col + c <= -1 || moduleCount <= col + c) continue;
              const isDark =
                (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                (2 <= r && r <= 4 && 2 <= c && c <= 4);
              modules[row + r][col + c] = isDark;
            }
          }
        }

        setupPositionProbe(0, 0);
        setupPositionProbe(moduleCount - 7, 0);
        setupPositionProbe(0, moduleCount - 7);

        // Alignment patterns
        const pos = PATTERN_POSITION_TABLE[typeNumber - 1] || [];
        for (let i = 0; i < pos.length; i++) {
          for (let j = 0; j < pos.length; j++) {
            const row = pos[i];
            const col = pos[j];
            if (modules[row][col] !== null) continue;
            for (let r = -2; r <= 2; r++) {
              for (let c = -2; c <= 2; c++) {
                modules[row + r][col + c] =
                  r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
              }
            }
          }
        }

        // Timing patterns
        for (let r = 8; r < moduleCount - 8; r++) {
          if (modules[r][6] === null) modules[r][6] = r % 2 === 0;
        }
        for (let c = 8; c < moduleCount - 8; c++) {
          if (modules[6][c] === null) modules[6][c] = c % 2 === 0;
        }

        // Type info (EC Level H = 2 -> binary 10)
        const bits = getBCHTypeInfo((2 << 3) | maskPattern);
        for (let i = 0; i < 15; i++) {
          const mod = !test && ((bits >> i) & 1) === 1;
          if (i < 6) modules[i][8] = mod;
          else if (i < 8) modules[i + 1][8] = mod;
          else modules[moduleCount - 15 + i][8] = mod;

          if (i < 8) modules[8][moduleCount - i - 1] = mod;
          else if (i < 9) modules[8][15 - i - 1 + 1] = mod;
          else modules[8][15 - i - 1] = mod;
        }
        modules[moduleCount - 8][8] = !test;

        // Type number for >= 7
        if (typeNumber >= 7) {
          const tBits = getBCHTypeNumber(typeNumber);
          for (let i = 0; i < 18; i++) {
            const mod = !test && ((tBits >> i) & 1) === 1;
            modules[Math.floor(i / 3)][(i % 3) + moduleCount - 8 - 3] = mod;
            modules[(i % 3) + moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
          }
        }

        // Map data
        let inc = -1;
        let row = moduleCount - 1;
        let bitIndex = 7;
        let byteIndex = 0;
        for (let col = moduleCount - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          while (true) {
            for (let c = 0; c < 2; c++) {
              if (modules[row][col - c] === null) {
                let dark = false;
                if (byteIndex < data.length) {
                  dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
                }
                if (getMask(maskPattern, row, col - c)) dark = !dark;
                modules[row][col - c] = dark;
                bitIndex--;
                if (bitIndex === -1) {
                  byteIndex++;
                  bitIndex = 7;
                }
              }
            }
            row += inc;
            if (row < 0 || moduleCount <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
        return modules;
      }

      function getLostPoint(modules) {
        let lostPoint = 0;
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            let sameCount = 0;
            const dark = modules[row][col];
            for (let r = -1; r <= 1; r++) {
              if (row + r < 0 || moduleCount <= row + r) continue;
              for (let c = -1; c <= 1; c++) {
                if (col + c < 0 || moduleCount <= col + c) continue;
                if (r === 0 && c === 0) continue;
                if (dark === modules[row + r][col + c]) sameCount++;
              }
            }
            if (sameCount > 5) lostPoint += 3 + sameCount - 5;
          }
        }
        for (let row = 0; row < moduleCount - 1; row++) {
          for (let col = 0; col < moduleCount - 1; col++) {
            let count = 0;
            if (modules[row][col]) count++;
            if (modules[row + 1][col]) count++;
            if (modules[row][col + 1]) count++;
            if (modules[row + 1][col + 1]) count++;
            if (count === 0 || count === 4) lostPoint += 3;
          }
        }
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount - 6; col++) {
            if (
              modules[row][col] &&
              !modules[row][col + 1] &&
              modules[row][col + 2] &&
              modules[row][col + 3] &&
              modules[row][col + 4] &&
              !modules[row][col + 5] &&
              modules[row][col + 6]
            ) {
              lostPoint += 40;
            }
          }
        }
        for (let col = 0; col < moduleCount; col++) {
          for (let row = 0; row < moduleCount - 6; row++) {
            if (
              modules[row][col] &&
              !modules[row + 1][col] &&
              modules[row + 2][col] &&
              modules[row + 3][col] &&
              modules[row + 4][col] &&
              !modules[row + 5][col] &&
              modules[row + 6][col]
            ) {
              lostPoint += 40;
            }
          }
        }
        let darkCount = 0;
        for (let col = 0; col < moduleCount; col++) {
          for (let row = 0; row < moduleCount; row++) {
            if (modules[row][col]) darkCount++;
          }
        }
        const ratio = Math.abs((100 * darkCount) / (moduleCount * moduleCount) - 50) / 5;
        lostPoint += ratio * 10;
        return lostPoint;
      }

      let bestPattern = 0;
      let minLostPoint = Infinity;
      for (let i = 0; i < 8; i++) {
        const testModules = buildMatrix(i, true);
        const lost = getLostPoint(testModules);
        if (lost < minLostPoint) {
          minLostPoint = lost;
          bestPattern = i;
        }
      }
      return buildMatrix(bestPattern, false);
    }

    function toDataURL(text, options) {
      const size = (options && options.width) || 320;
      const darkColor = (options && options.dark) || '#0f172a';
      const lightColor = (options && options.light) || '#ffffff';
      const marginModules = (options && options.margin) || 1.5;

      const modules = encodeBytes(text);
      const count = modules.length;
      const totalUnits = count + marginModules * 2;
      const scale = size / totalUnits;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = lightColor;
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = darkColor;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (modules[r][c]) {
            const x = Math.floor((c + marginModules) * scale);
            const y = Math.floor((r + marginModules) * scale);
            const w = Math.ceil((c + 1 + marginModules) * scale) - x;
            const h = Math.ceil((r + 1 + marginModules) * scale) - y;
            ctx.fillRect(x, y, w, h);
          }
        }
      }
      return canvas.toDataURL('image/png');
    }

    return { toDataURL };
  })();

  /* =========================================================================
   * 2. APPLICATION DATA
   * ========================================================================= */
  const APP_SCREENSHOTS = [
    {
      id: 'dashboard',
      title: 'Main Dashboard & Live Balance',
      category: 'Home',
      description: 'Track your real-time coin balance, explore trending tasks from CPX Research and Loot Partner, and access quick withdrawals.',
      image: './4_53181ee4.jpg',
      highlight: '₹2,190.00 Total Balance Display',
      badge: 'Core Screen'
    },
    {
      id: 'explore-offers',
      title: 'Explore High-Paying Offers',
      category: 'Offers',
      description: 'Earn instant coins by opening zero-balance accounts with AU Bank, Upstox, Navi UPI, and completing verified sponsor surveys.',
      image: './6_a04b08a8.jpg',
      highlight: 'Earn 10.00 - 150.00 Coins Per Offer',
      badge: 'High Yield'
    },
    {
      id: 'refer-earn',
      title: 'Refer & Earn Passive Income',
      category: 'Refer',
      description: 'Share your personal referral code (RB647RM6) via WhatsApp. Earn 5 coins (₹5) for every friend, while they receive 3 coins instantly.',
      image: './5_4d9e3fef.jpg',
      highlight: 'Earn ₹5 / Friend · Unlimited Referrals',
      badge: 'Passive Income'
    },
    {
      id: 'wallet',
      title: 'Instant Multi-Channel Wallet',
      category: 'Wallet',
      description: 'Inspect detailed earnings breakdowns, track referral commissions, and initiate bank payouts with 1 Coin = 1 Rupee transparency.',
      image: './7_ce21d9b0.jpg',
      highlight: '1 Coin = ₹1 · Min Payout ₹10',
      badge: 'Transparent'
    },
    {
      id: 'withdraw',
      title: 'Instant Bank & IFSC Withdrawal',
      category: 'Wallet',
      description: 'Submit your bank account number and IFSC code for direct IMPS/NEFT transfers deposited directly into your bank.',
      image: './8_5d727f5c.jpg',
      highlight: 'Direct IMPS Bank Settlement',
      badge: 'Fast Transfer'
    },
    {
      id: 'get-started',
      title: 'Sleek Onboarding Experience',
      category: 'Auth',
      description: 'Clean, lightning-fast launch sequence welcoming new and returning members to start accumulating rewards immediately.',
      image: './1_705b04dc.jpg',
      highlight: 'Zero Bloatware · Instant Launch',
      badge: 'Fast Start'
    },
    {
      id: 'otp-login',
      title: 'Instant 6-Digit OTP Sign-In',
      category: 'Auth',
      description: 'Login securely with your 10-digit mobile number and instant SMS verification code without cumbersome passwords.',
      image: './2_ce2f60ad.jpg',
      highlight: 'Passwordless Fast Verification',
      badge: 'Secure'
    },
    {
      id: 'password-login',
      title: 'Standard Password Security',
      category: 'Auth',
      description: 'Alternate password login option for returning users with encrypted credential storage.',
      image: './3_9ad9eadb.jpg',
      highlight: 'End-to-End Encrypted Auth',
      badge: 'Security'
    },
    {
      id: 'profile-theme',
      title: 'Dark & Light Mode Customization',
      category: 'Profile',
      description: 'Switch between clean light mode and sleek dark theme, access live Telegram support, and manage your tickets and privacy.',
      image: './9_a1577689.jpg',
      highlight: 'Dual Theme · Telegram Community',
      badge: 'Settings'
    }
  ];

  const APK_RELEASES = [
    {
      version: '2.4.0',
      name: 'Rewardzen Official Production Release',
      releaseDate: 'November 2026',
      size: '29.3 MB',
      minAndroid: 'Android 8.0+ (Oreo, Pie, 10, 11, 12, 13, 14, 15)',
      targetAndroid: 'Target SDK 34 (Android 14+)',
      sha256: 'a5793cb9209cb650678a543562c43c9caf45514121a621d7002fcb40bccad11c',
      filename: 'Rewardzen.apk',
      changelog: [
        'Authentic production build with compiled classes and native libraries',
        'Added instant IFSC verification algorithm for faster bank transfers',
        'Increased referral commission bonus: earn 5 coins per verified invite',
        'Integrated CPX Research high-yield survey partner pipeline',
        'Optimized dark mode contrast and battery endurance'
      ],
      isLatest: true
    },
    {
      version: '2.3.8',
      name: 'Rewardzen Legacy Compatibility Build',
      releaseDate: 'January 2026',
      size: '17.9 MB',
      minAndroid: 'Android 7.0+ (Nougat and above)',
      targetAndroid: 'Target SDK 33',
      sha256: '4e3189d2cbb54d7e868a4e3a890479f6e5c98d6263889025e14cb7b22a014a6e',
      filename: 'Rewardzen-v2.3.8-legacy.apk',
      changelog: [
        'Stable legacy release for older Android 7.0 and 7.1 devices',
        'Basic bank withdrawal and OTP login functionality'
      ],
      isLatest: false
    }
  ];

  /* =========================================================================
   * 3. MULTILINGUAL DICTIONARY (EN, ES, HI)
   * ========================================================================= */
  const TRANSLATIONS = {
    en: {
      nav: {
        benefits: 'Benefits',
        howItWorks: 'How it works',
        screens: 'App screens',
        calculator: 'Calculator',
        proofs: 'Payout proofs',
        faq: 'FAQs',
        downloadApk: 'Download APK',
        verifiedApk: 'Verified APK',
        androidVersion: 'Android 8.0 or newer'
      },
      hero: {
        kicker: 'Android rewards',
        rate: '1 Coin = 1 Rupee',
        speed: 'Fast bank transfer',
        headline: 'Download Rewardzen',
        subheadline: 'Earn coins by completing surveys with certified research partners, exploring verified banking offers, and inviting friends. Transfer money directly to your account starting at ten rupees.',
        downloadBtn: 'Download Rewardzen',
        viewScreensBtn: 'View nine production screens',
        reviewsText: '28,400 user reviews',
        minWithdrawalText: 'Minimum withdrawal',
        minWithdrawalValue: '10 Rupees',
        verifiedSafeText: 'Play Protect safe',
        directBankTitle: 'Direct bank transfer',
        directBankSub: 'Minimum 10 rupees',
        referralRewardTitle: 'Referral reward',
        referralRewardSub: 'Five rupees per invite',
        tapTabsHint: 'Tap tabs to preview live app screens'
      },
      tagline: {
        kicker: 'The core principle',
        words: [
          'Every', 'single', 'coin', 'converts', 'to', 'real', 'rupees,',
          'straight', 'to', 'your', 'bank', 'account', 'with', 'zero', 'hidden', 'fees.'
        ],
        subtext: 'One coin equals one rupee. Withdraw as soon as you earn ten rupees.'
      },
      howItWorks: {
        kicker: 'Simple process',
        title: 'How it works in three straightforward steps',
        subtitle: 'No complicated conversion tiers or points calculations. Every action turns directly into money in your wallet.',
        step1Title: 'Install the APK on your device',
        step1Desc: 'Download the lightweight Android package and sign in within seconds using your ten digit mobile number and one time password.',
        step2Title: 'Complete verified surveys and partner tasks',
        step2Desc: 'Choose from daily research questionnaires, zero balance banking offers, or share your referral code with friends.',
        step3Title: 'Withdraw real cash directly to your bank',
        step3Desc: 'Enter your account number and IFSC code. Transfers process through immediate payment services starting at ten rupees.',
        instantSettlement: 'Instant settlement',
        ctaBannerTitle: 'Ready to withdraw your first ten rupees today?',
        ctaBannerSub: 'Free download with verified package checksum.',
        downloadBtn: 'Download APK'
      },
      benefits: {
        kicker: 'Primary benefits',
        title: 'Built for guaranteed earnings and rapid payouts',
        subtitle: 'Every coin you collect is worth one rupee. Start withdrawing directly to your bank account with complete transparency.',
        card1Number: '01. Direct bank withdrawals',
        card1Badge: 'Minimum 10 rupees',
        card1Title: 'Immediate payment service transfers with zero deductions',
        card1Desc: 'Enter your bank account number and IFSC code directly in the application. Withdrawals are processed through rapid bank rails straight into State Bank of India, HDFC, ICICI, Axis, or any recognized bank.',
        b1Title: 'Accessible threshold',
        b1Desc: 'withdraw once you have ten coins.',
        b2Title: 'Flat exchange rate',
        b2Desc: 'one coin equals one rupee.',
        b3Title: 'Automated routing',
        b3Desc: 'verified IFSC code lookup.',
        b4Title: 'Complete records',
        b4Desc: 'full wallet transaction history.',
        balancePreviewLabel: 'Live balance in screen sample',
        inspectScreenBtn: 'Inspect screen',
        card2Number: '02. Verified research pipeline',
        card2Badge: 'Up to 150 coins',
        card2Title: 'Top tier brand tasks and market surveys',
        card2Desc: 'Access curated partner opportunities including zero balance banking accounts, free demat registration, and daily market research surveys through CPX Research.',
        card3Number: '03. Referral accelerator',
        card3Badge: 'Unlimited invites',
        card3Title: 'Earn five rupees for every friend who joins',
        card3Desc: 'Share your unique code directly to messaging apps. You receive five coins when your referral enters your code, and your friend receives three coins welcome bonus immediately.',
        codeSampleLabel: 'Sample referral code from app',
        shareReadyBadge: 'Share ready',
        card4Number: '04. Modern app design',
        card4Badge: 'Under 19 MB',
        card4Title: 'Lightweight, private and battery friendly',
        card4Desc: 'Engineered for quick startup on any Android smartphone from version 8.0 to 15. Includes light and dark themes, mobile phone verification, and a community support channel.',
        themeTitle: 'Dual theme',
        themeSub: 'Light and dark modes',
        otpTitle: 'One time password',
        otpSub: 'Passwordless sign in',
        getApkBtn: 'Download APK package'
      },
      calculator: {
        kicker: 'Earnings estimator',
        rate: 'One coin equals one rupee',
        title: 'Estimate your monthly payout potential',
        subtitle: 'Use the sliders below based on your available time for research tasks and friend recommendations.',
        tasksLabel: 'Completed tasks and surveys each day',
        tasksPerDay: 'per day',
        casual: '1 casual',
        active: '10 active',
        power: '20 power user',
        friendsLabel: 'Invited friends each month',
        friendsCount: 'friends',
        solo: '0 solo',
        social: '40 social',
        campus: '80 campus',
        settlementNote: 'Withdrawals settle in ten rupee increments directly to your bank account.',
        estimatedIncomeTitle: 'Estimated monthly income',
        perMonth: 'per month',
        coinsEquivalent: 'coins',
        dailyRunRate: 'Daily estimated rate',
        taskEarningsLabel: 'Task earnings',
        referralBonusLabel: 'Referral bonus',
        ctaBtn: 'Start earning with Rewardzen',
        freeApkNote: 'Free APK download for Android phones',
        tierCasual: 'Casual earner',
        tierActive: 'Active contributor',
        tierLeader: 'Community leader'
      },
      testimonials: {
        kicker: 'Verified payouts',
        title: 'Real user feedback and verified bank transfers',
        subtitle: 'See how active earners across India withdraw supplemental earnings directly to their bank accounts.',
        bannerKicker: 'Zero risk and free download',
        bannerTitle: 'Start earning your first ten rupees within fifteen minutes',
        bannerSub: 'Install the official package, verify with your phone number, and choose your first partner task.',
        downloadBtn: 'Download APK'
      },
      faq: {
        kicker: 'Questions and answers',
        clarity: 'Clarity first',
        title: 'Frequently asked questions',
        subtitle: 'Everything you need to know about coin exchange rates, safety verification, and bank transfers.',
        telegramTitle: 'Need direct assistance or want to talk to members?',
        telegramSub: 'Join our official community channel on Telegram.',
        joinTelegramBtn: 'Join Telegram'
      },
      modal: {
        title: 'Download Rewardzen APK',
        subtitle: 'Official Android package distribution',
        tabDirect: 'Direct APK file',
        tabScan: 'Scan to download',
        tabGuide: 'Installation guide',
        desktopNoticeTitle: 'Browsing on computer?',
        desktopNoticeDesc: 'Scan QR with your phone camera to download directly to Android.',
        scanQrBtn: 'Scan QR',
        selectBuildLabel: 'Select Android package build',
        checksumTitle: 'Package checksum verification',
        copyHashBtn: 'Copy hash',
        copiedText: 'Copied',
        verifiedNote: 'Verified zero modifications. Matches the signed production build.',
        detailsLabel: 'Package details:',
        downloadingText: 'Downloading',
        downloadCompleteText: 'Download complete. Check your downloads folder.',
        startDownloadBtn: 'Start direct download',
        activeDownloadsToday: 'active downloads today',
        verifiedSafeText: 'Verified safe',
        playProtectText: 'Google Play Protect safe',
        targetAndroidText: 'Target Android 14',
        scanHeaderTitle: 'Instant install on mobile',
        scanHeaderSub: 'Point your camera or Google Lens at this code to open the package download directly on your phone.',
        saveQrBtn: 'Save QR image',
        copyLinkBtn: 'Copy link',
        linkCopiedText: 'Link copied',
        switchDirectBtn: 'Switch to direct file download'
      },
      footer: {
        description: 'Rewardzen provides verified cash tasks, research questionnaires, and referral rewards for Android users, with direct bank account transfers.',
        safetyNote: 'Verified Android release with Play Protect safety',
        navTitle: 'Page navigation',
        getAppTitle: 'Get the application',
        getAppDesc: 'Download the official signed package file directly to your smartphone. Free of charge with zero in app subscription fees.',
        downloadApkBtn: 'Download APK (29.3 MB)',
        copyright: 'Rewardzen. All rights reserved. One coin equals one rupee.',
        privacy: 'Privacy policy',
        terms: 'Terms of service',
        help: 'Help center'
      }
    },
    es: {
      nav: {
        benefits: 'Beneficios',
        howItWorks: 'Cómo funciona',
        screens: 'Pantallas',
        calculator: 'Calculadora',
        proofs: 'Comprobantes',
        faq: 'Preguntas',
        downloadApk: 'Descargar APK',
        verifiedApk: 'APK verificada',
        androidVersion: 'Android 8.0 o posterior'
      },
      hero: {
        kicker: 'Recompensas Android',
        rate: '1 Moneda = 1 Rupia',
        speed: 'Transferencia bancaria rápida',
        headline: 'Download Rewardzen',
        subheadline: 'Gana monedas completando encuestas verificadas, explorando ofertas bancarias asociadas e invitando amigos. Transfiere dinero directamente a tu cuenta bancaria desde diez rupias.',
        downloadBtn: 'Descargar Rewardzen',
        viewScreensBtn: 'Ver nueve pantallas reales',
        reviewsText: '28,400 opiniones de usuarios',
        minWithdrawalText: 'Retiro mínimo',
        minWithdrawalValue: '10 Rupias',
        verifiedSafeText: 'Seguro con Play Protect',
        directBankTitle: 'Transferencia bancaria directa',
        directBankSub: 'Mínimo 10 rupias',
        referralRewardTitle: 'Recompensa por referidos',
        referralRewardSub: 'Cinco rupias por invitado',
        tapTabsHint: 'Toca las pestañas para explorar pantallas'
      },
      tagline: {
        kicker: 'El principio fundamental',
        words: [
          'Cada', 'moneda', 'se', 'convierte', 'en', 'dinero', 'real,',
          'directo', 'a', 'tu', 'cuenta', 'bancaria', 'sin', 'comisiones', 'ocultas.'
        ],
        subtext: 'Una moneda equivale a una rupia. Retira tan pronto como ganes diez rupias.'
      },
      howItWorks: {
        kicker: 'Proceso sencillo',
        title: 'Cómo funciona en tres pasos claros',
        subtitle: 'Sin fórmulas complicadas ni niveles confusos. Cada tarea se convierte directamente en saldo disponible en tu billetera.',
        step1Title: 'Instala la APK en tu teléfono',
        step1Desc: 'Descarga el paquete ligero para Android e inicia sesión en segundos con tu número de teléfono y código de verificación.',
        step2Title: 'Completa encuestas y tareas verificadas',
        step2Desc: 'Elige entre cuestionarios de investigación diaria, cuentas bancarias gratuitas o comparte tu código de invitación.',
        step3Title: 'Retira dinero directo a tu banco',
        step3Desc: 'Ingresa tu número de cuenta y clave bancaria. Los pagos se transfieren inmediatamente a partir de diez rupias.',
        instantSettlement: 'Liquidación inmediata',
        ctaBannerTitle: '¿Listo para retirar tus primeras diez rupias hoy?',
        ctaBannerSub: 'Descarga gratuita con código de verificación seguro.',
        downloadBtn: 'Descargar APK'
      },
      benefits: {
        kicker: 'Beneficios principales',
        title: 'Diseñado para ganancias garantizadas y retiros rápidos',
        subtitle: 'Cada moneda que acumulas vale una rupia. Retira directamente a tu cuenta bancaria con total transparencia.',
        card1Number: '01. Retiros bancarios directos',
        card1Badge: 'Mínimo 10 rupias',
        card1Title: 'Transferencias bancarias instantáneas sin comisiones',
        card1Desc: 'Ingresa tu número de cuenta bancaria y código IFSC en la aplicación. Los retiros se procesan a través de canales bancarios inmediatos.',
        b1Title: 'Retiro accesible',
        b1Desc: 'retira en cuanto tengas diez monedas.',
        b2Title: 'Tasa fija 1 a 1',
        b2Desc: 'una moneda equivale a una rupia.',
        b3Title: 'Ruta automatizada',
        b3Desc: 'verificación bancaria instantánea.',
        b4Title: 'Historial completo',
        b4Desc: 'registro detallado de cada retiro.',
        balancePreviewLabel: 'Saldo real en muestra de pantalla',
        inspectScreenBtn: 'Inspeccionar pantalla',
        card2Number: '02. Tareas e investigaciones verificadas',
        card2Badge: 'Hasta 150 monedas',
        card2Title: 'Encuestas de marcas reconocidas y tareas seguras',
        card2Desc: 'Accede a ofertas seleccionadas incluyendo apertura de cuentas sin saldo mínimo y encuestas diarias con CPX Research.',
        card3Number: '03. Programa de referidos',
        card3Badge: 'Invitaciones ilimitadas',
        card3Title: 'Gana cinco rupias por cada amigo que se una',
        card3Desc: 'Comparte tu código por mensajería. Recibes cinco monedas cuando tu invitado se registra, y tu amigo recibe tres monedas de bienvenida.',
        codeSampleLabel: 'Código de referido de muestra',
        shareReadyBadge: 'Listo para compartir',
        card4Number: '04. Aplicación moderna y ligera',
        card4Badge: 'Menos de 19 MB',
        card4Title: 'Ligera, privada y de bajo consumo de batería',
        card4Desc: 'Optimizada para teléfonos Android desde la versión 8.0 hasta 15. Incluye modo claro y oscuro, acceso sin contraseñas y soporte comunitario.',
        themeTitle: 'Tema dual',
        themeSub: 'Modo claro y oscuro',
        otpTitle: 'Código de un solo uso',
        otpSub: 'Acceso seguro sin contraseña',
        getApkBtn: 'Descargar paquete APK'
      },
      calculator: {
        kicker: 'Calculadora de ingresos',
        rate: 'Una moneda equivale a una rupia',
        title: 'Estima tu potencial de ganancias mensuales',
        subtitle: 'Ajusta los controles según el tiempo que quieras dedicar a encuestas y recomendaciones con amigos.',
        tasksLabel: 'Tareas y encuestas completadas al día',
        tasksPerDay: 'al día',
        casual: '1 casual',
        active: '10 activo',
        power: '20 avanzado',
        friendsLabel: 'Amigos invitados al mes',
        friendsCount: 'amigos',
        solo: '0 individual',
        social: '40 social',
        campus: '80 embajador',
        settlementNote: 'Los retiros se pagan en incrementos de diez rupias directo a tu cuenta bancaria.',
        estimatedIncomeTitle: 'Ingreso mensual estimado',
        perMonth: 'al mes',
        coinsEquivalent: 'monedas',
        dailyRunRate: 'Promedio diario estimado',
        taskEarningsLabel: 'Ganancias por tareas',
        referralBonusLabel: 'Bono por referidos',
        ctaBtn: 'Comenzar a ganar con Rewardzen',
        freeApkNote: 'Descarga gratuita de APK para Android',
        tierCasual: 'Usuario casual',
        tierActive: 'Contribuidor activo',
        tierLeader: 'Líder comunitario'
      },
      testimonials: {
        kicker: 'Comprobantes verificados',
        title: 'Opiniones reales y comprobantes bancarios',
        subtitle: 'Descubre cómo usuarios activos retiran ingresos adicionales directamente a sus cuentas bancarias.',
        bannerKicker: 'Sin riesgo y descarga gratuita',
        bannerTitle: 'Empieza a retirar tus primeras diez rupias hoy',
        bannerSub: 'Instala la aplicación oficial, verifica tu número de teléfono y completa tu primera tarea.',
        downloadBtn: 'Descargar APK'
      },
      faq: {
        kicker: 'Preguntas y respuestas',
        clarity: 'Claridad ante todo',
        title: 'Preguntas frecuentes',
        subtitle: 'Todo lo que necesitas saber sobre el valor de las monedas, seguridad y retiros bancarios.',
        telegramTitle: '¿Necesitas ayuda directa o conversar con usuarios?',
        telegramSub: 'Únete a nuestro canal oficial de la comunidad en Telegram.',
        joinTelegramBtn: 'Entrar a Telegram'
      },
      modal: {
        title: 'Descargar Rewardzen APK',
        subtitle: 'Distribución oficial de la aplicación Android',
        tabDirect: 'Archivo APK directo',
        tabScan: 'Escanear para descargar',
        tabGuide: 'Guía de instalación',
        desktopNoticeTitle: '¿Navegas desde computadora?',
        desktopNoticeDesc: 'Escanea el código QR con la cámara de tu teléfono para descargar en Android.',
        scanQrBtn: 'Ver QR',
        selectBuildLabel: 'Selecciona la versión del paquete',
        checksumTitle: 'Verificación de integridad SHA256',
        copyHashBtn: 'Copiar código',
        copiedText: 'Copiado',
        verifiedNote: 'Verificado sin modificaciones. Coincide con la versión firmada de producción.',
        detailsLabel: 'Detalles del paquete:',
        downloadingText: 'Descargando',
        downloadCompleteText: 'Descarga completada. Revisa tu carpeta de descargas.',
        startDownloadBtn: 'Iniciar descarga directa',
        activeDownloadsToday: 'descargas activas hoy',
        verifiedSafeText: 'Verificado seguro',
        playProtectText: 'Certificado por Google Play Protect',
        targetAndroidText: 'Compatible con Android 14',
        scanHeaderTitle: 'Instalación instantánea en móvil',
        scanHeaderSub: 'Apunta tu cámara o Google Lens a este código para iniciar la descarga en tu smartphone.',
        saveQrBtn: 'Guardar imagen QR',
        copyLinkBtn: 'Copiar enlace',
        linkCopiedText: 'Enlace copiado',
        switchDirectBtn: 'Cambiar a descarga directa'
      },
      footer: {
        description: 'Rewardzen ofrece tareas remuneradas verificadas, encuestas de investigación y recompensas por recomendación con transferencias bancarias directas.',
        safetyNote: 'Versión oficial de Android verificada por Play Protect',
        navTitle: 'Navegación',
        getAppTitle: 'Obtén la aplicación',
        getAppDesc: 'Descarga el archivo APK oficial firmado directamente a tu teléfono inteligente. Gratis y sin costos ocultos.',
        downloadApkBtn: 'Descargar APK (29.3 MB)',
        copyright: 'Rewardzen. Todos los derechos reservados. Una moneda equivale a una rupia.',
        privacy: 'Política de privacidad',
        terms: 'Términos de servicio',
        help: 'Centro de ayuda'
      }
    },
    hi: {
      nav: {
        benefits: 'फायदे',
        howItWorks: 'यह कैसे काम करता है',
        screens: 'ऐप स्क्रीन',
        calculator: 'कमाई कैलकुलेटर',
        proofs: 'पेमेंट सबूत',
        faq: 'सवाल जवाब',
        downloadApk: 'APK डाउनलोड करें',
        verifiedApk: 'सत्यापित APK',
        androidVersion: 'एंड्रॉइड 8.0 या नया'
      },
      hero: {
        kicker: 'सत्यापित एंड्रॉइड रिवॉर्ड्स',
        rate: '1 कॉइन = 1 रुपया',
        speed: 'तुरंत बैंक ट्रांसफर',
        headline: 'Download Rewardzen',
        subheadline: 'सत्यापित रिसर्च पार्टनर्स के सर्वे पूरे करें, बैंक अकाउंट ऑफर्स आज़माएं और दोस्तों को आमंत्रित करें। मात्र 10 रुपये से सीधे अपने बैंक खाते में पैसे निकालें।',
        downloadBtn: 'Download Rewardzen',
        viewScreensBtn: '9 इन ऐप स्क्रीन देखें',
        reviewsText: '28,400+ संतुष्ट उपयोगकर्ता',
        minWithdrawalText: 'न्यूनतम निकासी',
        minWithdrawalValue: '10 रुपये',
        verifiedSafeText: 'प्ले प्रोटेक्ट सुरक्षित',
        directBankTitle: 'सीधा बैंक ट्रांसफर',
        directBankSub: 'न्यूनतम केवल 10 रुपये',
        referralRewardTitle: 'रेफरल इनाम',
        referralRewardSub: 'हर दोस्त पर 5 रुपये',
        tapTabsHint: 'स्क्रीन बदलने के लिए ऊपर टैब पर टैप करें'
      },
      tagline: {
        kicker: 'हमारा मुख्य सिद्धांत',
        words: [
          'हर', 'एक', 'कॉइन', 'सीधे', 'रुपये', 'में', 'बदलता', 'है,',
          'बिना', 'किसी', 'छुपे', 'शुल्क', 'के', 'सीधा', 'आपके', 'बैंक', 'खाते', 'में।'
        ],
        subtext: 'एक कॉइन बराबर एक रुपया। 10 रुपये होते ही तुरंत बैंक में ट्रांसफर करें।'
      },
      howItWorks: {
        kicker: 'आसान प्रक्रिया',
        title: 'केवल तीन सरल चरणों में काम करता है',
        subtitle: 'कोई जटिल पॉइंट सिस्टम नहीं। हर काम का फल तुरंत आपके वॉलेट में असली रुपये बनकर जुड़ता है।',
        step1Title: 'अपने फ़ोन में APK इनस्टॉल करें',
        step1Desc: 'हल्का एंड्रॉइड पैकेज डाउनलोड करें और अपने 10 अंकों के मोबाइल नंबर व OTP से कुछ ही सेकंड में लॉगिन करें।',
        step2Title: 'सत्यापित सर्वे और टास्क पूरे करें',
        step2Desc: 'दैनिक रिसर्च सर्वे, जीरो बैलेंस बैंक अकाउंट ऑफर्स चुनें या अपने दोस्तों को इनवाइट कोड भेजें।',
        step3Title: 'असली कैश सीधे बैंक खाते में पाएं',
        step3Desc: 'अपना बैंक अकाउंट नंबर और IFSC कोड दर्ज करें। केवल 10 रुपये से IMPS के जरिए तुरंत पैसे ट्रांसफर होते हैं।',
        instantSettlement: 'तुरंत पेमेंट',
        ctaBannerTitle: 'क्या आप आज ही अपने पहले 10 रुपये निकालना चाहते हैं?',
        ctaBannerSub: 'सुरक्षित चेकसम के साथ 100% मुफ्त डाउनलोड।',
        downloadBtn: 'APK डाउनलोड करें'
      },
      benefits: {
        kicker: 'मुख्य फायदे',
        title: 'गारंटीड कमाई और सबसे तेज़ निकासी के लिए निर्मित',
        subtitle: 'आपका कमाया हर एक कॉइन एक रुपये के बराबर है। पूरी पारदर्शिता के साथ सीधे बैंक में निकासी शुरू करें।',
        card1Number: '01. सीधा बैंक ट्रांसफर',
        card1Badge: 'न्यूनतम केवल 10 रुपये',
        card1Title: 'बिना किसी कटौती के तुरंत IMPS बैंक ट्रांसफर',
        card1Desc: 'ऐप में अपना बैंक खाता नंबर और IFSC कोड डालें। SBI, HDFC, ICICI, Axis या किसी भी भारतीय बैंक में तुरंत पैसे प्राप्त करें।',
        b1Title: 'आसान न्यूनतम सीमा',
        b1Desc: 'सिर्फ 10 कॉइन होते ही पैसे निकालें।',
        b2Title: 'समान दर 1 बराबर 1',
        b2Desc: 'एक कॉइन बराबर पूरा एक रुपया।',
        b3Title: 'ऑटोमैटिक IFSC सत्यापन',
        b3Desc: 'सही बैंक शाखा की तुरंत पहचान।',
        b4Title: 'पारदर्शी वॉलेट लेजर',
        b4Desc: 'हर निकासी का स्पष्ट रिकॉर्ड।',
        balancePreviewLabel: 'ऐप में लाइव बैलेंस नमूना',
        inspectScreenBtn: 'स्क्रीन देखें',
        card2Number: '02. टॉप ब्रांड्स और सर्वे पार्टनरशिप',
        card2Badge: 'प्रति सर्वे 150 कॉइन तक',
        card2Title: 'विश्वसनीय ब्रांड्स और दैनिक रिसर्च सर्वे',
        card2Desc: 'AU Bank, Upstox, Navi UPI जैसे भरोसेमंद संस्थानों के ऑफर्स और CPX Research के दैनिक सर्वे से कमाई करें।',
        card3Number: '03. रेफर एंड अर्न प्रोग्राम',
        card3Badge: 'अनलिमिटेड इनवाइट्स',
        card3Title: 'हर दोस्त के जुड़ने पर पाएं 5 रुपये',
        card3Desc: 'अपना इनवाइट कोड सीधे WhatsApp पर शेयर करें। दोस्त के जुड़ते ही आपको 5 कॉइन और दोस्त को 3 कॉइन तुरंत मिलते हैं।',
        codeSampleLabel: 'ऐप से रेफरल कोड का नमूना',
        shareReadyBadge: 'शेयर के लिए तैयार',
        card4Number: '04. आधुनिक और सुरक्षित ऐप',
        card4Badge: '19 MB से कम',
        card4Title: 'हल्का, सुरक्षित और बैटरी फ्रेंडली',
        card4Desc: 'एंड्रॉइड 8.0 से 15 तक सभी स्मार्टफ़ोन पर बिना हैंग हुए चलता है। डार्क व लाइट मोड और OTP लॉगिन की सुविधा उपलब्ध है।',
        themeTitle: 'ड्युअल थीम',
        themeSub: 'लाइट और डार्क मोड',
        otpTitle: 'OTP लॉगिन',
        otpSub: 'पासवर्ड याद रखने का झंझट नहीं',
        getApkBtn: 'APK पैकेज डाउनलोड करें'
      },
      calculator: {
        kicker: 'कमाई कैलकुलेटर',
        rate: 'एक कॉइन = एक रुपया',
        title: 'अपनी संभावित मासिक कमाई का अनुमान लगाएं',
        subtitle: 'नीचे दिए गए स्लाइडर को अपनी सुविधानुसार सेट करें और देखें कि आप महीने में कितना कमा सकते हैं।',
        tasksLabel: 'प्रतिदिन पूरे किए गए टास्क और सर्वे',
        tasksPerDay: 'प्रतिदिन',
        casual: '1 सामान्य',
        active: '10 सक्रिय',
        power: '20 पावर यूजर',
        friendsLabel: 'प्रति माह आमंत्रित किए गए दोस्त',
        friendsCount: 'दोस्त',
        solo: '0 अकेले',
        social: '40 सोशल',
        campus: '80 कैंपस लीडर',
        settlementNote: 'कमाई 10 रुपये के गुणांक में सीधे आपके बैंक खाते में जमा होती है।',
        estimatedIncomeTitle: 'अनुमानित मासिक आमदनी',
        perMonth: 'प्रति माह',
        coinsEquivalent: 'कॉइन',
        dailyRunRate: 'दैनिक अनुमानित दर',
        taskEarningsLabel: 'टास्क से कमाई',
        referralBonusLabel: 'रेफरल बोनस',
        ctaBtn: 'Rewardzen से कमाई शुरू करें',
        freeApkNote: 'एंड्रॉइड फ़ोन के लिए मुफ्त APK डाउनलोड',
        tierCasual: 'सामान्य उपयोगकर्ता',
        tierActive: 'सक्रिय अर्नर',
        tierLeader: 'कम्युनिटी लीडर'
      },
      testimonials: {
        kicker: 'सत्यापित पेमेंट्स',
        title: 'असली उपयोगकर्ताओं की राय और बैंक ट्रांसफर रसीदें',
        subtitle: 'देखें कि भारत भर के उपयोगकर्ता अतिरिक्त कमाई को सीधे अपने बैंक खाते में कैसे प्राप्त कर रहे हैं।',
        bannerKicker: 'शून्य जोखिम और मुफ्त डाउनलोड',
        bannerTitle: 'आज ही 15 मिनट के भीतर अपने पहले 10 रुपये निकालें',
        bannerSub: 'ऑफिशियल पैकेज इंस्टॉल करें, मोबाइल नंबर से वेरिफाई करें और अपना पहला टास्क शुरू करें।',
        downloadBtn: 'APK डाउनलोड करें'
      },
      faq: {
        kicker: 'अक्सर पूछे जाने वाले सवाल',
        clarity: 'स्पष्टता सबसे पहले',
        title: 'सवाल और जवाब',
        subtitle: 'कॉइन कन्वर्शन, सुरक्षा और बैंक ट्रांसफर के बारे में हर ज़रूरी जानकारी।',
        telegramTitle: 'सीधी मदद चाहिए या अन्य उपयोगकर्ताओं से जुड़ना चाहते हैं?',
        telegramSub: 'हमारे ऑफिशियल टेलीग्राम कम्युनिटी चैनल से अभी जुड़ें।',
        joinTelegramBtn: 'टेलीग्राम से जुड़ें'
      },
      modal: {
        title: 'Rewardzen APK डाउनलोड करें',
        subtitle: 'आधिकारिक एंड्रॉइड पैकेज वितरण',
        tabDirect: 'सीधी APK फ़ाइल',
        tabScan: 'QR स्कैन कर डाउनलोड करें',
        tabGuide: 'इंस्टॉलेशन गाइड',
        desktopNoticeTitle: 'क्या आप कंप्यूटर पर हैं?',
        desktopNoticeDesc: 'अपने फ़ोन के कैमरे से QR कोड स्कैन करें और सीधे एंड्रॉइड पर डाउनलोड करें।',
        scanQrBtn: 'QR देखें',
        selectBuildLabel: 'एंड्रॉइड पैकेज वर्जन चुनें',
        checksumTitle: 'पैकेज चेकसम सुरक्षा सत्यापन',
        copyHashBtn: 'हैश कॉपी करें',
        copiedText: 'कॉपी हो गया',
        verifiedNote: 'सत्यापित शून्य बदलाव। आधिकारिक प्रोडक्शन पैकेज से मेल खाता है।',
        detailsLabel: 'पैकेज की विशेषताएं:',
        downloadingText: 'डाउनलोड हो रहा है',
        downloadCompleteText: 'डाउनलोड पूरा हुआ। अपने डाउनलोड फोल्डर में चेक करें।',
        startDownloadBtn: 'सीधा डाउनलोड शुरू करें',
        activeDownloadsToday: 'आज सक्रिय डाउनलोड',
        verifiedSafeText: 'सत्यापित सुरक्षित',
        playProtectText: 'गूगल प्ले प्रोटेक्ट द्वारा सुरक्षित',
        targetAndroidText: 'एंड्रॉइड 14 समर्थित',
        scanHeaderTitle: 'मोबाइल पर तुरंत इनस्टॉल करें',
        scanHeaderSub: 'अपने फ़ोन का कैमरा या Google Lens इस कोड की ओर करें और तुरंत डाउनलोड शुरू करें।',
        saveQrBtn: 'QR इमेज सेव करें',
        copyLinkBtn: 'लिंक कॉपी करें',
        linkCopiedText: 'लिंक कॉपी हो गया',
        switchDirectBtn: 'सीधी फ़ाइल डाउनलोड पर जाएं'
      },
      footer: {
        description: 'Rewardzen एंड्रॉइड उपयोगकर्ताओं के लिए सत्यापित कैश टास्क, रिसर्च सर्वे और सीधा बैंक ट्रांसफर प्रदान करता है।',
        safetyNote: 'प्ले प्रोटेक्ट द्वारा सत्यापित एंड्रॉइड वितरण',
        navTitle: 'पेज नेविगेशन',
        getAppTitle: 'ऐप प्राप्त करें',
        getAppDesc: 'ऑफिशियल हस्ताक्षरित APK फ़ाइल सीधे अपने स्मार्टफ़ोन पर डाउनलोड करें। बिना किसी सदस्यता शुल्क के 100% मुफ्त।',
        downloadApkBtn: 'APK डाउनलोड करें (29.3 MB)',
        copyright: 'Rewardzen. सर्वाधिकार सुरक्षित। एक कॉइन बराबर एक रुपया।',
        privacy: 'गोपनीयता नीति',
        terms: 'सेवा की शर्तें',
        help: 'सहायता केंद्र'
      }
    }
  };

  /* =========================================================================
   * 4. STATE & STORAGE
   * ========================================================================= */
  const STORAGE_KEY = 'rewardzen_language';
  let currentLanguage = 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es' || saved === 'hi') {
      currentLanguage = saved;
    }
  } catch (e) {
    // ignore storage restriction
  }

  let selectedScreenIndex = 0;
  let activeFilterCategory = 'All';
  let selectedApkVersion = '2.4.0';
  let activeModalTab = 'download';
  let isDownloadModalOpen = false;
  let isMobileMenuOpen = false;
  let isLangMenuOpen = false;
  let currentQrDataUrl = '';
  let downloadTimer = null;
  let openFaqIndex = 0;
  let taglineTimerIds = [];
  let hasTaglineRevealed = false;

  /* =========================================================================
   * 5. DOM HELPERS & TRANSLATIONS
   * ========================================================================= */
  function getByPath(obj, path) {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), obj);
  }

  function applyTranslations() {
    const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

    // Static [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = getByPath(t, key);
      if (typeof val === 'string' && val.length > 0) {
        el.textContent = val;
      }
    });

    // Dynamic start download button label with release size
    updateModalVersionUI();

    // Update Language Switcher badges
    const langCodeEl = document.getElementById('lang-code-label');
    if (langCodeEl) langCodeEl.textContent = currentLanguage.toUpperCase();

    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      const code = btn.getAttribute('data-lang-option');
      const isSelected = code === currentLanguage;
      const checkIcon = btn.querySelector('.lang-check-icon');
      if (isSelected) {
        btn.classList.add('bg-slate-50', 'text-slate-900', 'font-bold');
        btn.classList.remove('text-slate-600');
        if (checkIcon) checkIcon.classList.remove('hidden');
      } else {
        btn.classList.remove('bg-slate-50', 'text-slate-900', 'font-bold');
        btn.classList.add('text-slate-600');
        if (checkIcon) checkIcon.classList.add('hidden');
      }
    });

    document.querySelectorAll('[data-mobile-lang]').forEach((btn) => {
      const code = btn.getAttribute('data-mobile-lang');
      if (code === currentLanguage) {
        btn.className = 'button-xsm py-1 px-2.5 rounded-md transition-smooth bg-slate-900 text-white font-semibold shadow-xs';
      } else {
        btn.className = 'button-xsm py-1 px-2.5 rounded-md transition-smooth text-slate-600 hover:text-slate-900 bg-white border border-slate-200';
      }
    });

    // Re-render tagline words in active language
    renderTaglineWords(hasTaglineRevealed);

    // Recalculate earnings labels (tier + daily rate text)
    updateCalculator();
  }

  function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'es' && lang !== 'hi') return;
    currentLanguage = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // ignore storage errors
    }
    applyTranslations();
  }

  /* =========================================================================
   * 6. NAVBAR & LANGUAGE SWITCHER
   * ========================================================================= */
  function initNavbar() {
    const langBtn = document.getElementById('lang-switcher-btn');
    const langDropdown = document.getElementById('lang-dropdown');
    const langChevron = document.getElementById('lang-chevron');
    const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const mobileIconMenu = document.getElementById('mobile-icon-menu');
    const mobileIconClose = document.getElementById('mobile-icon-close');

    if (langBtn && langDropdown) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isLangMenuOpen = !isLangMenuOpen;
        langBtn.setAttribute('aria-expanded', String(isLangMenuOpen));
        langDropdown.classList.toggle('hidden', !isLangMenuOpen);
        if (langChevron) langChevron.classList.toggle('rotate-180', isLangMenuOpen);
      });

      document.addEventListener('mousedown', (e) => {
        const container = document.getElementById('lang-switcher-container');
        if (isLangMenuOpen && container && !container.contains(e.target)) {
          isLangMenuOpen = false;
          langBtn.setAttribute('aria-expanded', 'false');
          langDropdown.classList.add('hidden');
          if (langChevron) langChevron.classList.remove('rotate-180');
        }
      });
    }

    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLanguage(btn.getAttribute('data-lang-option'));
        isLangMenuOpen = false;
        if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
        if (langDropdown) langDropdown.classList.add('hidden');
        if (langChevron) langChevron.classList.remove('rotate-180');
      });
    });

    document.querySelectorAll('[data-mobile-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLanguage(btn.getAttribute('data-mobile-lang'));
      });
    });

    if (mobileMenuBtn && mobileDrawer) {
      mobileMenuBtn.addEventListener('click', () => {
        isMobileMenuOpen = !isMobileMenuOpen;
        mobileDrawer.classList.toggle('hidden', !isMobileMenuOpen);
        if (mobileIconMenu) mobileIconMenu.classList.toggle('hidden', isMobileMenuOpen);
        if (mobileIconClose) mobileIconClose.classList.toggle('hidden', !isMobileMenuOpen);
      });

      mobileDrawer.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', () => {
          isMobileMenuOpen = false;
          mobileDrawer.classList.add('hidden');
          if (mobileIconMenu) mobileIconMenu.classList.remove('hidden');
          if (mobileIconClose) mobileIconClose.classList.add('hidden');
        });
      });
    }
  }

  /* =========================================================================
   * 7. HERO & SHOWCASE SCREEN SYNC
   * ========================================================================= */
  function selectScreen(idx) {
    if (idx < 0 || idx >= APP_SCREENSHOTS.length) return;
    selectedScreenIndex = idx;
    const screen = APP_SCREENSHOTS[idx];

    // Hero phone updates (when idx <= 4, or show latest selected in hero too)
    const heroImg = document.getElementById('hero-phone-img');
    const heroTitle = document.getElementById('hero-phone-title');
    const heroHighlight = document.getElementById('hero-phone-highlight');
    const heroBadge = document.getElementById('hero-phone-badge');

    if (idx < 5) {
      if (heroImg) {
        heroImg.src = screen.image;
        heroImg.alt = screen.title;
      }
      if (heroTitle) heroTitle.textContent = screen.title;
      if (heroHighlight) heroHighlight.textContent = screen.highlight;
      if (heroBadge) heroBadge.textContent = screen.badge;

      document.querySelectorAll('[data-hero-tab]').forEach((tab) => {
        const tIdx = Number(tab.getAttribute('data-hero-tab'));
        if (tIdx === idx) {
          tab.className = 'caption-3 py-1.5 px-3 rounded-lg transition-smooth whitespace-nowrap bg-white text-slate-900 shadow-xs ring-1 ring-slate-200';
        } else {
          tab.className = 'caption-3 py-1.5 px-3 rounded-lg transition-smooth whitespace-nowrap text-slate-600 hover:text-slate-900';
        }
      });
    }

    // Showcase Carousel updates
    const scImg = document.getElementById('showcase-img');
    const scCat = document.getElementById('showcase-category-label');
    const scBadge = document.getElementById('showcase-badge');
    const scTitle = document.getElementById('showcase-title');
    const scDesc = document.getElementById('showcase-description');
    const scHighlight = document.getElementById('showcase-highlight');

    if (scImg) {
      scImg.src = screen.image;
      scImg.alt = screen.title;
    }
    if (scCat) scCat.textContent = screen.category + ' screen';
    if (scBadge) scBadge.textContent = screen.badge;
    if (scTitle) scTitle.textContent = screen.title;
    if (scDesc) scDesc.textContent = screen.description;
    if (scHighlight) scHighlight.textContent = screen.highlight;

    // Pagination dots
    document.querySelectorAll('[data-showcase-dot]').forEach((dot) => {
      const dIdx = Number(dot.getAttribute('data-showcase-dot'));
      dot.className = dIdx === idx
        ? 'h-2 rounded-full transition-smooth w-6 bg-slate-900'
        : 'h-2 rounded-full transition-smooth w-2 bg-slate-200 hover:bg-slate-400';
    });

    // Thumbnails
    document.querySelectorAll('[data-showcase-thumb]').forEach((thumb) => {
      const thIdx = Number(thumb.getAttribute('data-showcase-thumb'));
      if (thIdx === idx) {
        thumb.className = 'relative aspect-[9/16] rounded-lg overflow-hidden border transition-smooth border-slate-900 ring-2 ring-slate-900/30 scale-102 shadow-xs';
      } else {
        thumb.className = 'relative aspect-[9/16] rounded-lg overflow-hidden border transition-smooth border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-400';
      }
    });
  }

  function initShowcase() {
    // Hero tabs
    document.querySelectorAll('[data-hero-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectScreen(Number(btn.getAttribute('data-hero-tab')));
      });
    });

    // Bento "Inspect screen" buttons
    document.querySelectorAll('[data-inspect-screen]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-inspect-screen');
        const idx = APP_SCREENSHOTS.findIndex((s) => s.id === targetId);
        if (idx !== -1) {
          selectScreen(idx);
          const el = document.getElementById('showcase');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Showcase Category filter tabs
    document.querySelectorAll('[data-showcase-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilterCategory = btn.getAttribute('data-showcase-filter') || 'All';
        document.querySelectorAll('[data-showcase-filter]').forEach((b) => {
          const isMatch = b.getAttribute('data-showcase-filter') === activeFilterCategory;
          b.className = isMatch
            ? 'caption-4 py-1.5 px-3 rounded-lg transition-smooth whitespace-nowrap shrink-0 bg-slate-900 text-white font-semibold shadow-xs'
            : 'caption-4 py-1.5 px-3 rounded-lg transition-smooth whitespace-nowrap shrink-0 text-slate-600 hover:text-slate-900 hover:bg-slate-50';
        });
        if (activeFilterCategory !== 'All') {
          const matchIdx = APP_SCREENSHOTS.findIndex((s) => s.category === activeFilterCategory);
          if (matchIdx !== -1) selectScreen(matchIdx);
        }
      });
    });

    // Showcase Arrows
    const prevBtn = document.getElementById('showcase-prev');
    const nextBtn = document.getElementById('showcase-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        selectScreen((selectedScreenIndex - 1 + APP_SCREENSHOTS.length) % APP_SCREENSHOTS.length);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        selectScreen((selectedScreenIndex + 1) % APP_SCREENSHOTS.length);
      });
    }

    // Showcase Dots & Thumbnails
    document.querySelectorAll('[data-showcase-dot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectScreen(Number(btn.getAttribute('data-showcase-dot')));
      });
    });
    document.querySelectorAll('[data-showcase-thumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectScreen(Number(btn.getAttribute('data-showcase-thumb')));
      });
    });

    // Lightbox Modal
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxDownload = document.getElementById('lightbox-download-btn');

    function openLightbox() {
      const screen = APP_SCREENSHOTS[selectedScreenIndex];
      const lbImg = document.getElementById('lightbox-img');
      const lbTitle = document.getElementById('lightbox-title');
      const lbCat = document.getElementById('lightbox-category');
      if (lbImg) {
        lbImg.src = screen.image;
        lbImg.alt = screen.title;
      }
      if (lbTitle) lbTitle.textContent = screen.title;
      if (lbCat) lbCat.textContent = screen.category;
      if (lightboxModal) {
        lightboxModal.classList.remove('hidden');
        lightboxModal.classList.add('flex');
      }
    }

    function closeLightbox() {
      if (lightboxModal) {
        lightboxModal.classList.add('hidden');
        lightboxModal.classList.remove('flex');
      }
    }

    document.querySelectorAll('[data-open-lightbox]').forEach((btn) => {
      btn.addEventListener('click', openLightbox);
    });

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) closeLightbox();
      });
    }
    if (lightboxDownload) {
      lightboxDownload.addEventListener('click', () => {
        closeLightbox();
        openDownloadModal('download');
      });
    }

    selectScreen(0);
  }

  /* =========================================================================
   * 8. TAGLINE SCROLL REVEAL (B11)
   * ========================================================================= */
  function renderTaglineWords(revealAll) {
    const container = document.getElementById('tagline-words');
    if (!container) return;
    const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    const words = t.tagline.words || [];
    container.innerHTML = '';

    words.forEach((word) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.className = 'inline-block mr-2.5 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]';
      span.style.opacity = revealAll ? '1' : '0.28';
      span.style.color = revealAll ? '#0f172a' : '#94a3b8';
      container.appendChild(span);
    });
  }

  function initTaglineReveal() {
    const triggerEl = document.getElementById('tagline-reveal-container');
    if (!triggerEl) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      hasTaglineRevealed = true;
      renderTaglineWords(true);
      return;
    }

    renderTaglineWords(false);

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              hasTaglineRevealed = true;
              taglineTimerIds.forEach(clearTimeout);
              taglineTimerIds = [];
              const spans = document.querySelectorAll('#tagline-words span');
              spans.forEach((span, idx) => {
                const tid = setTimeout(() => {
                  span.style.opacity = '1';
                  span.style.color = '#0f172a';
                }, idx * 60);
                taglineTimerIds.push(tid);
              });
              observer.disconnect();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(triggerEl);
    } else {
      hasTaglineRevealed = true;
      renderTaglineWords(true);
    }
  }

  /* =========================================================================
   * 9. EARNINGS CALCULATOR
   * ========================================================================= */
  function updateCalculator() {
    const tasksSlider = document.getElementById('tasks-slider');
    const friendsSlider = document.getElementById('friends-slider');
    if (!tasksSlider || !friendsSlider) return;

    const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    const dailyTasks = Number(tasksSlider.value);
    const friendsInvited = Number(friendsSlider.value);

    const avgCoinPerTask = 15;
    const monthlyTaskCoins = dailyTasks * avgCoinPerTask * 30;
    const referralSignupCoins = friendsInvited * 5;
    const referralActivityBonus = Math.round(friendsInvited * 20);
    const totalReferralBonus = referralSignupCoins + referralActivityBonus;

    const totalMonthlyCoins = monthlyTaskCoins + totalReferralBonus;
    const totalMonthlyRupees = totalMonthlyCoins;
    const dailyEarnings = Math.round(totalMonthlyRupees / 30);

    let tier = { title: t.calculator.tierLeader, badge: 'Level 3' };
    if (totalMonthlyRupees < 1500) {
      tier = { title: t.calculator.tierCasual, badge: 'Level 1' };
    } else if (totalMonthlyRupees < 4000) {
      tier = { title: t.calculator.tierActive, badge: 'Level 2' };
    }

    const tasksBadge = document.getElementById('calc-tasks-badge');
    const friendsBadge = document.getElementById('calc-friends-badge');
    const tierBadge = document.getElementById('calc-tier-badge');
    const totalRupeesEl = document.getElementById('calc-total-rupees');
    const totalCoinsEl = document.getElementById('calc-total-coins');
    const dailyRateEl = document.getElementById('calc-daily-rate');
    const taskEarningsEl = document.getElementById('calc-task-earnings');
    const referralBonusEl = document.getElementById('calc-referral-bonus');

    if (tasksBadge) tasksBadge.textContent = dailyTasks + ' ' + t.calculator.tasksPerDay;
    if (friendsBadge) friendsBadge.textContent = friendsInvited + ' ' + t.calculator.friendsCount;
    if (tierBadge) tierBadge.textContent = tier.badge + ' · ' + tier.title;
    if (totalRupeesEl) totalRupeesEl.textContent = totalMonthlyRupees.toLocaleString();
    if (totalCoinsEl) totalCoinsEl.textContent = totalMonthlyCoins.toLocaleString() + ' ' + t.calculator.coinsEquivalent;
    if (dailyRateEl) dailyRateEl.textContent = '≈ ₹' + dailyEarnings + ' ' + t.calculator.tasksPerDay;
    if (taskEarningsEl) taskEarningsEl.textContent = '₹' + monthlyTaskCoins.toLocaleString();
    if (referralBonusEl) referralBonusEl.textContent = '+₹' + totalReferralBonus.toLocaleString();
  }

  function initCalculator() {
    const tasksSlider = document.getElementById('tasks-slider');
    const friendsSlider = document.getElementById('friends-slider');
    if (tasksSlider) tasksSlider.addEventListener('input', updateCalculator);
    if (friendsSlider) friendsSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  /* =========================================================================
   * 10. FAQ ACCORDION
   * ========================================================================= */
  function setFaqOpen(idx) {
    openFaqIndex = openFaqIndex === idx ? null : idx;
    document.querySelectorAll('[data-faq-item]').forEach((item) => {
      const itemIdx = Number(item.getAttribute('data-faq-item'));
      const answer = item.querySelector('[data-faq-answer]');
      const chevron = item.querySelector('[data-faq-chevron]');
      const isOpen = openFaqIndex === itemIdx;
      if (answer) answer.classList.toggle('hidden', !isOpen);
      if (chevron) {
        chevron.classList.toggle('rotate-180', isOpen);
        chevron.classList.toggle('text-slate-900', isOpen);
        chevron.classList.toggle('text-slate-400', !isOpen);
      }
    });
  }

  function initFaq() {
    document.querySelectorAll('[data-faq-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-faq-toggle'));
        setFaqOpen(idx);
      });
    });
  }

  /* =========================================================================
   * 11. DOWNLOAD MODAL, VERSION SELECTOR, SHA256 COPY, AND PURE JS QR CODE
   * ========================================================================= */
  function getCurrentRelease() {
    return APK_RELEASES.find((r) => r.version === selectedApkVersion) || APK_RELEASES[0];
  }

  function getDynamicDownloadUrl() {
    const rel = getCurrentRelease();
    const origin = typeof window !== 'undefined' && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://rewardzen.app';
    return origin + '/?download=' + rel.version + '&auto=true';
  }

  function refreshQrCode() {
    const qrImg = document.getElementById('modal-qr-img');
    const urlText = document.getElementById('modal-qr-url');
    const testLink = document.getElementById('modal-qr-test-link');
    const pkgNameEl = document.getElementById('modal-qr-package');
    const rel = getCurrentRelease();
    const dynamicUrl = getDynamicDownloadUrl();

    if (urlText) urlText.textContent = dynamicUrl;
    if (testLink) testLink.href = dynamicUrl;
    if (pkgNameEl) pkgNameEl.textContent = rel.filename;

    try {
      currentQrDataUrl = PureQR.toDataURL(dynamicUrl, {
        width: 320,
        margin: 1.5,
        dark: '#0f172a',
        light: '#ffffff'
      });
      if (qrImg) {
        qrImg.src = currentQrDataUrl;
        qrImg.alt = 'QR Code to Download Rewardzen v' + rel.version;
      }
    } catch (err) {
      console.error('QR generation failed', err);
    }
  }

  function updateModalVersionUI() {
    const rel = getCurrentRelease();
    const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

    // Highlight version buttons (Direct tab)
    document.querySelectorAll('[data-version-btn]').forEach((btn) => {
      const v = btn.getAttribute('data-version-btn');
      if (v === selectedApkVersion) {
        btn.className = 'p-3 rounded-2xl border text-left transition-smooth border-slate-900 bg-slate-50 ring-1 ring-slate-900';
      } else {
        btn.className = 'p-3 rounded-2xl border text-left transition-smooth border-slate-200 hover:border-slate-300 bg-white';
      }
    });

    // Highlight version pills (QR tab)
    document.querySelectorAll('[data-qr-version-btn]').forEach((btn) => {
      const v = btn.getAttribute('data-qr-version-btn');
      if (v === selectedApkVersion) {
        btn.className = 'py-1 px-3 rounded-lg transition-smooth bg-slate-900 text-white font-semibold shadow-xs';
      } else {
        btn.className = 'py-1 px-3 rounded-lg transition-smooth text-slate-600 hover:text-slate-900';
      }
    });

    // SHA-256 text
    const shaEl = document.getElementById('modal-sha256');
    if (shaEl) shaEl.textContent = rel.sha256;

    // Changelog (top 3 items)
    const changelogEl = document.getElementById('modal-changelog');
    if (changelogEl) {
      changelogEl.innerHTML = '';
      rel.changelog.slice(0, 3).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'flex items-start gap-2';
        row.innerHTML = '<span class="text-slate-900 font-bold">·</span><span></span>';
        row.querySelector('span:last-child').textContent = item;
        changelogEl.appendChild(row);
      });
    }

    // Download button text
    const dlBtnText = document.getElementById('modal-start-download-label');
    if (dlBtnText) {
      dlBtnText.textContent = t.modal.startDownloadBtn + ' (' + rel.size + ')';
    }

    refreshQrCode();
  }

  function setModalTab(tab) {
    activeModalTab = tab;
    document.querySelectorAll('[data-modal-tab]').forEach((btn) => {
      const isMatch = btn.getAttribute('data-modal-tab') === tab;
      btn.className = isMatch
        ? 'py-3 px-3 border-b-2 transition-smooth flex items-center gap-1.5 border-slate-900 text-slate-900 font-semibold'
        : 'py-3 px-3 border-b-2 transition-smooth flex items-center gap-1.5 border-transparent text-slate-500 hover:text-slate-800';
    });

    document.querySelectorAll('[data-modal-panel]').forEach((panel) => {
      const pTab = panel.getAttribute('data-modal-panel');
      panel.classList.toggle('hidden', pTab !== tab);
    });

    if (tab === 'qr') refreshQrCode();
  }

  function openDownloadModal(tab) {
    isDownloadModalOpen = true;
    const modal = document.getElementById('download-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    setModalTab(tab || 'download');
    updateModalVersionUI();
  }

  function closeDownloadModal() {
    isDownloadModalOpen = false;
    const modal = document.getElementById('download-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function triggerApkFileDownload(filename) {
    const link = document.createElement('a');
    link.href = './Rewardzen.apk';
    link.download = filename || 'Rewardzen.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function initDownloadModal() {
    const modal = document.getElementById('download-modal');
    const closeBtn = document.getElementById('modal-close-btn');

    // Open triggers across page
    document.querySelectorAll('[data-open-download]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-open-download') || 'download';
        openDownloadModal(tab);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeDownloadModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDownloadModal();
      });
    }

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isDownloadModalOpen) closeDownloadModal();
        const lb = document.getElementById('lightbox-modal');
        if (lb && !lb.classList.contains('hidden')) {
          lb.classList.add('hidden');
          lb.classList.remove('flex');
        }
      }
    });

    // Tab switching
    document.querySelectorAll('[data-modal-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setModalTab(btn.getAttribute('data-modal-tab')));
    });

    document.querySelectorAll('[data-switch-modal-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setModalTab(btn.getAttribute('data-switch-modal-tab')));
    });

    // Version selection (Direct & QR tabs)
    document.querySelectorAll('[data-version-btn], [data-qr-version-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-version-btn') || btn.getAttribute('data-qr-version-btn');
        if (v) {
          selectedApkVersion = v;
          updateModalVersionUI();
        }
      });
    });

    // Copy SHA256
    const copyHashBtn = document.getElementById('modal-copy-hash');
    if (copyHashBtn) {
      copyHashBtn.addEventListener('click', () => {
        const rel = getCurrentRelease();
        if (navigator.clipboard) navigator.clipboard.writeText(rel.sha256);
        const defaultState = document.getElementById('copy-hash-default');
        const copiedState = document.getElementById('copy-hash-copied');
        if (defaultState) defaultState.classList.add('hidden');
        if (copiedState) {
          copiedState.classList.remove('hidden');
          copiedState.classList.add('flex');
        }
        setTimeout(() => {
          if (defaultState) defaultState.classList.remove('hidden');
          if (copiedState) {
            copiedState.classList.add('hidden');
            copiedState.classList.remove('flex');
          }
        }, 2000);
      });
    }

    // Start Direct Download with progress animation
    const startBtn = document.getElementById('modal-start-download-btn');
    const idleBox = document.getElementById('modal-download-idle');
    const progressBox = document.getElementById('modal-download-progress');
    const progressBar = document.getElementById('modal-progress-bar');
    const progressPct = document.getElementById('modal-progress-pct');
    const progressFile = document.getElementById('modal-progress-filename');
    const progressNote = document.getElementById('modal-progress-note');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const rel = getCurrentRelease();
        const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
        let pct = 10;

        if (idleBox) idleBox.classList.add('hidden');
        if (progressBox) progressBox.classList.remove('hidden');
        if (progressFile) progressFile.textContent = t.modal.downloadingText + ' ' + rel.filename + '...';
        if (progressPct) progressPct.textContent = pct + '%';
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressNote) progressNote.textContent = 'Allocating package payload...';

        if (downloadTimer) clearInterval(downloadTimer);
        downloadTimer = setInterval(() => {
          pct += 30;
          if (pct >= 100) {
            pct = 100;
            clearInterval(downloadTimer);
            downloadTimer = null;
            if (progressPct) progressPct.textContent = '100%';
            if (progressBar) progressBar.style.width = '100%';
            if (progressNote) progressNote.textContent = t.modal.downloadCompleteText;

            triggerApkFileDownload(rel.filename);

            setTimeout(() => {
              if (progressBox) progressBox.classList.add('hidden');
              if (idleBox) idleBox.classList.remove('hidden');
            }, 1500);
          } else {
            if (progressPct) progressPct.textContent = pct + '%';
            if (progressBar) progressBar.style.width = pct + '%';
          }
        }, 200);
      });
    }

    // Save QR PNG
    const saveQrBtn = document.getElementById('modal-save-qr');
    if (saveQrBtn) {
      saveQrBtn.addEventListener('click', () => {
        if (!currentQrDataUrl) return;
        const rel = getCurrentRelease();
        const link = document.createElement('a');
        link.href = currentQrDataUrl;
        link.download = 'Rewardzen-QR-v' + rel.version + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    // Copy Link
    const copyLinkBtn = document.getElementById('modal-copy-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        const url = getDynamicDownloadUrl();
        if (navigator.clipboard) navigator.clipboard.writeText(url);
        const defEl = document.getElementById('copy-link-default');
        const doneEl = document.getElementById('copy-link-done');
        if (defEl) defEl.classList.add('hidden');
        if (doneEl) {
          doneEl.classList.remove('hidden');
          doneEl.classList.add('flex');
        }
        setTimeout(() => {
          if (defEl) defEl.classList.remove('hidden');
          if (doneEl) {
            doneEl.classList.add('hidden');
            doneEl.classList.remove('flex');
          }
        }, 2000);
      });
    }

    // URL query auto-detect (?download=...&auto=true or ?scan=true)
    try {
      const params = new URLSearchParams(window.location.search);
      const dlVersion = params.get('download');
      if (dlVersion || params.get('scan') === 'true') {
        if (dlVersion === '2.3.8' || dlVersion === '2.4.0') {
          selectedApkVersion = dlVersion;
        }
        openDownloadModal('download');
        if (params.get('auto') === 'true') {
          triggerApkFileDownload(getCurrentRelease().filename);
        }
      }
    } catch (e) {
      // ignore invalid URL search params
    }
  }

  /* =========================================================================
   * 12. BOOTSTRAP ON DOM READY
   * ========================================================================= */
  function init() {
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    initNavbar();
    initShowcase();
    initTaglineReveal();
    initCalculator();
    initFaq();
    initDownloadModal();
    applyTranslations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
