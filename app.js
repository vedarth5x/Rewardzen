/**
 * Rewardzen Landing Page — Pure Vanilla JavaScript
 * Zero React, Zero npm, Zero external JS dependencies.
 */

(function () {
  'use strict';

  /* =========================================================================
   * 1. ZERO-DEPENDENCY PURE JS QR CODE ENCODER (Byte mode, EC Level H)
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
      buffer.put(4, 4);
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

        for (let r = 8; r < moduleCount - 8; r++) {
          if (modules[r][6] === null) modules[r][6] = r % 2 === 0;
        }
        for (let c = 8; c < moduleCount - 8; c++) {
          if (modules[6][c] === null) modules[6][c] = c % 2 === 0;
        }

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

        if (typeNumber >= 7) {
          const tBits = getBCHTypeNumber(typeNumber);
          for (let i = 0; i < 18; i++) {
            const mod = !test && ((tBits >> i) & 1) === 1;
            modules[Math.floor(i / 3)][(i % 3) + moduleCount - 8 - 3] = mod;
            modules[(i % 3) + moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
          }
        }

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
      const darkColor = (options && options.dark) || '#160a38';
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
   * 2. APP DATA (Opportunities, Real Screenshots, Releases)
   * ========================================================================= */
  const OPPORTUNITIES = {
    surveys: {
      title: 'Paid Surveys — Share opinions & earn fast',
      desc: 'Answer quick partner surveys from CPX Research and BitLabs tailored to your profile.',
      payout: 'Avg. 10 – 60 Coins per survey'
    },
    tasks: {
      title: 'Simple Tasks — Everyday micro-actions',
      desc: 'Complete quick verified tasks inside the app and watch your coin wallet update instantly.',
      payout: 'Avg. 5 – 45 Coins per task'
    },
    exclusive: {
      title: 'Exclusive Offers — High-value partner deals',
      desc: 'Unlock featured offers with zero-balance accounts like AU Bank, Upstox, and Navi UPI.',
      payout: 'Earn 25 – 150 Coins per offer'
    },
    apps: {
      title: 'App & Website Offers — Try & earn rewards',
      desc: 'Discover trusted partner apps and websites and collect coins upon quick verification.',
      payout: 'Earn 10 – 80 Coins per install'
    },
    refer: {
      title: 'Refer & Earn — Invite friends, earn together',
      desc: 'Share your referral code via WhatsApp. Earn 5 coins per friend plus activity bonuses.',
      payout: '5 Coins signup + lifetime bonus'
    },
    more: {
      title: 'More Earning Options — Daily streaks & bonus drops',
      desc: 'Claim daily check-in rewards, leaderboard milestones, and rotating Loot Partner walls.',
      payout: 'Up to 100+ extra Coins weekly'
    }
  };

  const APP_SCREENSHOTS = [
    {
      title: 'Dashboard & Live Balance',
      category: 'Home',
      desc: 'Track real-time coins, daily rewards, and quick withdrawals.',
      image: './4_53181ee4.jpg'
    },
    {
      title: 'Explore High-Paying Offers',
      category: 'Offers',
      desc: 'Complete trusted sponsor offers & partner surveys.',
      image: './6_a04b08a8.jpg'
    },
    {
      title: 'Refer & Earn Passive Coins',
      category: 'Refer',
      desc: 'Invite friends and earn instant signup & task bonuses.',
      image: './3_9ad9eadb.jpg'
    },
    {
      title: 'Instant UPI & Bank Payouts',
      category: 'Wallet',
      desc: 'Withdraw directly starting from ₹5 with 1 Coin = ₹1.',
      image: './2_ce2f60ad.jpg'
    },
    {
      title: 'Task Verification Feed',
      category: 'Offers',
      desc: 'Monitor pending and completed offers transparently.',
      image: './7_ce21d9b0.jpg'
    },
    {
      title: 'Account & Security Settings',
      category: 'Home',
      desc: 'Manage linked payout methods and referral stats.',
      image: './8_5d727f5c.jpg'
    },
    {
      title: 'Transaction Ledger',
      category: 'Wallet',
      desc: 'View every coin earned and rupee withdrawn cleanly.',
      image: './9_a1577689.jpg'
    },
    {
      title: 'Quick Onboarding Flow',
      category: 'Home',
      desc: 'Start earning within 60 seconds after installing.',
      image: './1_705b04dc.jpg'
    },
    {
      title: 'Daily Bonus & Streaks',
      category: 'Offers',
      desc: 'Claim extra coins daily just for opening the app.',
      image: './5_4d9e3fef.jpg'
    }
  ];

  const APK_RELEASES = [
    {
      version: '2.4.0',
      size: '29.3 MB',
      filename: 'Rewardzen.apk',
      sha256: 'a5793cb9209cb650678a543562c43c9caf45514121a621d7002fcb40bccad11c'
    },
    {
      version: '2.3.8',
      size: '29.3 MB',
      filename: 'Rewardzen.apk',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    }
  ];

  /* =========================================================================
   * 3. MULTI-LANGUAGE DICTIONARY (EN / ES / HI persisted in localStorage)
   * ========================================================================= */
  const TRANSLATIONS = {
    en: {
      nav: { home: 'Home', how: 'How it Works', options: 'Earning Options', reviews: 'Reviews', download: 'Download App' },
      hero: {
        eyebrow: "India's Trusted Reward Platform",
        titleLine1: 'Complete Tasks &',
        titleLine2: 'Earn Real Rewards',
        subtitle: 'Discover multiple ways to earn online. Complete tasks, take paid surveys, explore exclusive offers and invite friends to earn rewards.',
        pillar1: 'Certified Partners',
        pillar2: 'Fast Payouts',
        pillar3: 'Safe & Secure',
        cta: 'Download Rewardzen App'
      },
      phone: { tasks: 'Tasks', surveys: 'Surveys', offers: 'Offers', refer: 'Refer & Earn' },
      stats: {
        reviews: '28,400+ User Reviews',
        coinRate: '1 Coin = ₹1',
        coinSub: 'Real & Simple Rewards',
        minLabel: 'Minimum<br />Withdrawal'
      },
      opp: {
        heading: 'Multiple Earning Opportunities',
        sub: 'Explore different ways to earn with Rewardzen.',
        surveys: 'Paid Surveys',
        tasks: 'Simple Tasks',
        exclusive: 'Exclusive Offers',
        apps: 'App & Website Offers',
        refer: 'Refer & Earn',
        more: 'More Earning Options',
        tryBtn: 'Start in App'
      },
      how: {
        titlePrefix: 'How It',
        titleGold: 'Works?',
        subtitle: 'Start earning in just 3 simple steps.',
        step1Title: 'Download & Register',
        step1Desc: 'Install the Rewardzen app and create your account.',
        step2Title: 'Complete Tasks',
        step2Desc: 'Explore surveys, offers and other tasks.',
        step3Title: 'Earn & Withdraw',
        step3Desc: 'Collect coins and withdraw your earnings from ₹5.'
      },
      why: {
        titlePrefix: 'Why Choose',
        item1: 'Multiple Earning Opportunities',
        item2: 'Easy & Quick Online Tasks',
        item3: 'Trusted & Verified Partners',
        item4: 'Fast & Convenient Withdrawals'
      },
      screens: {
        title: 'Inside the Rewardzen App',
        subtitle: 'Preview real screens and verified member feedback before downloading.',
        tabAll: 'All Screens',
        tabHome: 'Dashboard',
        tabOffers: 'Offers & Surveys',
        tabWallet: 'Withdrawals',
        tabRefer: 'Refer & Earn'
      },
      reviews: {
        heading: 'Verified User Reviews (4.8 / 5.0)',
        sub: '28,400+ active members redeeming directly via UPI & bank transfer.',
        q1: '"Withdrew ₹240 straight to UPI after completing 3 banking offers and daily surveys. Coins credited within minutes."',
        q2: '"1 Coin = ₹1 keeps everything transparent. The ₹5 minimum withdrawal makes it easy to test payouts right away."',
        q3: '"Invited my college group using my referral code and earned steady bonus coins every time they completed tasks."'
      },
      calc: {
        heading: 'Monthly Earnings Estimator',
        sub: 'Slide to estimate your monthly rewards at 1 Coin = ₹1.',
        tasksLabel: 'Daily tasks & surveys',
        friendsLabel: 'Friends invited this month',
        estLabel: 'Estimated Monthly Payout'
      },
      bottom: {
        titlePrefix: 'Ready to',
        titleGold: 'Start Earning?',
        sub: 'Download Rewardzen App now and explore multiple ways to earn real rewards!'
      },
      footer: { directApk: 'Direct APK' },
      modal: {
        title: 'Download Rewardzen APK',
        sub: 'Verified Android package · Android 8.0+',
        tabDirect: 'Direct APK',
        tabQr: 'Scan QR Code',
        tabGuide: 'Install Guide',
        qrHint: 'Scan this QR code with your Android phone camera to download Rewardzen directly.'
      }
    },
    es: {
      nav: { home: 'Inicio', how: 'Cómo Funciona', options: 'Opciones', reviews: 'Reseñas', download: 'Descargar App' },
      hero: {
        eyebrow: 'Plataforma Confiable de Recompensas',
        titleLine1: 'Completa Tareas y',
        titleLine2: 'Gana Premios Reales',
        subtitle: 'Descubre múltiples formas de ganar en línea. Completa tareas, encuestas pagadas, ofertas exclusivas e invita amigos.',
        pillar1: 'Socios Certificados',
        pillar2: 'Pagos Rápidos',
        pillar3: 'Seguro y Privado',
        cta: 'Descargar App Rewardzen'
      },
      phone: { tasks: 'Tareas', surveys: 'Encuestas', offers: 'Ofertas', refer: 'Invitar y Ganar' },
      stats: {
        reviews: '28,400+ Reseñas',
        coinRate: '1 Moneda = ₹1',
        coinSub: 'Recompensas Reales',
        minLabel: 'Retiro<br />Mínimo'
      },
      opp: {
        heading: 'Múltiples Formas de Ganar',
        sub: 'Explora diferentes maneras de generar recompensas con Rewardzen.',
        surveys: 'Encuestas Pagadas',
        tasks: 'Tareas Simples',
        exclusive: 'Ofertas Exclusivas',
        apps: 'Ofertas de Apps y Web',
        refer: 'Invitar y Ganar',
        more: 'Más Opciones',
        tryBtn: 'Abrir en la App'
      },
      how: {
        titlePrefix: '¿Cómo',
        titleGold: 'Funciona?',
        subtitle: 'Empieza a ganar en solo 3 simples pasos.',
        step1Title: 'Descarga y Regístrate',
        step1Desc: 'Instala la aplicación Rewardzen y crea tu cuenta.',
        step2Title: 'Completa Tareas',
        step2Desc: 'Explora encuestas, ofertas y tareas rápidas.',
        step3Title: 'Gana y Retira',
        step3Desc: 'Acumula monedas y retira tus ganancias desde ₹5.'
      },
      why: {
        titlePrefix: '¿Por Qué Elegir',
        item1: 'Múltiples Opciones para Ganar',
        item2: 'Tareas Rápidas y Fáciles',
        item3: 'Socios Verificados y Seguros',
        item4: 'Retiros Rápidos y Cómodos'
      },
      screens: {
        title: 'Dentro de Rewardzen',
        subtitle: 'Explora pantallas reales y opiniones verificadas antes de descargar.',
        tabAll: 'Todas',
        tabHome: 'Panel',
        tabOffers: 'Ofertas',
        tabWallet: 'Retiros',
        tabRefer: 'Referidos'
      },
      reviews: {
        heading: 'Reseñas Verificadas (4.8 / 5.0)',
        sub: 'Más de 28,400 usuarios retirando directo a UPI y banco.',
        q1: '"Retiré ₹240 directo a UPI después de completar 3 ofertas y encuestas diarias. Las monedas llegaron en minutos."',
        q2: '"1 Moneda = ₹1 es súper transparente. El retiro mínimo de ₹5 permite probar los pagos de inmediato."',
        q3: '"Invité a mis compañeros con mi código y gané bonos cada vez que completaron tareas."'
      },
      calc: {
        heading: 'Calculadora Mensual',
        sub: 'Calcula tus ganancias mensuales a 1 Moneda = ₹1.',
        tasksLabel: 'Tareas y encuestas diarias',
        friendsLabel: 'Amigos invitados al mes',
        estLabel: 'Pago Mensual Estimado'
      },
      bottom: {
        titlePrefix: '¿Listo para',
        titleGold: 'Empezar a Ganar?',
        sub: '¡Descarga Rewardzen App ahora y explora múltiples formas de ganar premios reales!'
      },
      footer: { directApk: 'APK Directo' },
      modal: {
        title: 'Descargar Rewardzen APK',
        sub: 'Paquete Android verificado · Android 8.0+',
        tabDirect: 'APK Directo',
        tabQr: 'Código QR',
        tabGuide: 'Guía de Instalación',
        qrHint: 'Escanea este código QR con la cámara de tu Android para descargar Rewardzen.'
      }
    },
    hi: {
      nav: { home: 'होम', how: 'कैसे काम करता है', options: 'कमाई के विकल्प', reviews: 'रिव्यूज़', download: 'ऐप डाउनलोड करें' },
      hero: {
        eyebrow: 'भारत का भरोसेमंद रिवॉर्ड प्लेटफॉर्म',
        titleLine1: 'टास्क पूरे करें और',
        titleLine2: 'असली इनाम कमाएं',
        subtitle: 'ऑनलाइन कमाने के कई तरीके खोजें। टास्क पूरे करें, पेड सर्वे भरें, एक्सक्लूसिव ऑफ़र देखें और दोस्तों को रेफर करें।',
        pillar1: 'प्रमाणित पार्टनर्स',
        pillar2: 'तेज़ पेआउट',
        pillar3: 'सुरक्षित और भरोसेमंद',
        cta: 'Rewardzen ऐप डाउनलोड करें'
      },
      phone: { tasks: 'टास्क', surveys: 'सर्वे', offers: 'ऑफ़र्स', refer: 'रेफर और कमाई' },
      stats: {
        reviews: '28,400+ यूज़र रिव्यूज़',
        coinRate: '1 कॉइन = ₹1',
        coinSub: 'सीधा और आसान इनाम',
        minLabel: 'न्यूनतम<br />निकासी'
      },
      opp: {
        heading: 'कमाई के कई अवसर',
        sub: 'Rewardzen के साथ कमाई के अलग-अलग तरीके एक्सप्लोर करें।',
        surveys: 'पेड सर्वे',
        tasks: 'आसान टास्क',
        exclusive: 'एक्सक्लूसिव ऑफ़र्स',
        apps: 'ऐप व वेबसाइट ऑफ़र्स',
        refer: 'रेफर और कमाई',
        more: 'अन्य विकल्प',
        tryBtn: 'ऐप में शुरू करें'
      },
      how: {
        titlePrefix: 'यह कैसे',
        titleGold: 'काम करता है?',
        subtitle: 'बस 3 आसान स्टेप्स में कमाई शुरू करें।',
        step1Title: 'डाउनलोड और रजिस्टर करें',
        step1Desc: 'Rewardzen ऐप इंस्टॉल करें और अपना अकाउंट बनाएं।',
        step2Title: 'टास्क पूरे करें',
        step2Desc: 'सर्वे, ऑफ़र्स और आसान टास्क एक्सप्लोर करें।',
        step3Title: 'कमाएं और निकालें',
        step3Desc: 'कॉइन्स जमा करें और ₹5 से अपनी कमाई निकालें।'
      },
      why: {
        titlePrefix: 'क्यों चुनें',
        item1: 'कमाई के अनेक विकल्प',
        item2: 'आसान और तेज़ ऑनलाइन टास्क',
        item3: 'भरोसेमंद और वेरिफाइड पार्टनर्स',
        item4: 'तेज़ और सुविधाजनक निकासी'
      },
      screens: {
        title: 'Rewardzen ऐप की झलक',
        subtitle: 'डाउनलोड करने से पहले असली स्क्रीन और यूज़र रिव्यूज़ देखें।',
        tabAll: 'सभी स्क्रीन',
        tabHome: 'डैशबोर्ड',
        tabOffers: 'ऑफ़र्स व सर्वे',
        tabWallet: 'निकासी',
        tabRefer: 'रेफर व कमाई'
      },
      reviews: {
        heading: 'सत्यापित यूज़र रिव्यूज़ (4.8 / 5.0)',
        sub: '28,400+ एक्टिव यूज़र्स सीधे UPI और बैंक में पैसे निकाल रहे हैं।',
        q1: '"3 बैंकिंग ऑफ़र्स और डेली सर्वे पूरे करने के बाद ₹240 सीधे UPI में निकाले। कॉइन्स मिनटों में मिल गए।"',
        q2: '"1 कॉइन = ₹1 से सब कुछ एकदम साफ है। ₹5 की न्यूनतम निकासी से तुरंत पेआउट चेक कर सकते हैं।"',
        q3: '"अपने कॉलेज ग्रुप को रेफर कोड शेयर किया और उनके हर टास्क पर मुझे बोनस कॉइन्स मिले।"'
      },
      calc: {
        heading: 'मासिक कमाई कैलकुलेटर',
        sub: '1 कॉइन = ₹1 के हिसाब से अपनी संभावित मासिक कमाई देखें।',
        tasksLabel: 'रोज़ाना टास्क और सर्वे',
        friendsLabel: 'इस महीने आमंत्रित दोस्त',
        estLabel: 'अनुमानित मासिक कमाई'
      },
      bottom: {
        titlePrefix: 'क्या आप कमाई शुरू',
        titleGold: 'करने के लिए तैयार हैं?',
        sub: 'अभी Rewardzen ऐप डाउनलोड करें और असली इनाम कमाने के कई तरीके खोजें!'
      },
      footer: { directApk: 'डायरेक्ट APK' },
      modal: {
        title: 'Rewardzen APK डाउनलोड करें',
        sub: 'सत्यापित Android पैकेज · Android 8.0+',
        tabDirect: 'डायरेक्ट APK',
        tabQr: 'QR स्कैन करें',
        tabGuide: 'इंस्टॉल गाइड',
        qrHint: 'Rewardzen सीधे डाउनलोड करने के लिए अपने Android फोन के कैमरे से यह QR कोड स्कैन करें।'
      }
    }
  };

  /* =========================================================================
   * 4. STATE
   * ========================================================================= */
  let currentLanguage = 'en';
  try {
    const saved = localStorage.getItem('rewardzen_language');
    if (saved && TRANSLATIONS[saved]) currentLanguage = saved;
  } catch (e) {
    // ignore storage restriction
  }

  let selectedApkVersion = '2.4.0';
  let currentQrDataUrl = '';
  let downloadTimer = null;
  let activeScreenFilter = 'all';

  /* =========================================================================
   * 5. LANGUAGE & I18N
   * ========================================================================= */
  function getByPath(obj, path) {
    return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
  }

  function applyTranslations() {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    document.documentElement.lang = currentLanguage;

    const codeEl = document.getElementById('current-lang-code');
    if (codeEl) codeEl.textContent = currentLanguage.toUpperCase();

    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      const code = btn.getAttribute('data-lang-option');
      btn.classList.toggle('is-selected', code === currentLanguage);
    });

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = getByPath(dict, key);
      if (typeof val === 'string') {
        if (val.indexOf('<br') !== -1) {
          el.innerHTML = val;
        } else {
          el.textContent = val;
        }
      }
    });
  }

  function initLanguageSwitcher() {
    const toggleBtn = document.getElementById('lang-toggle-btn');
    const menu = document.getElementById('lang-dropdown-menu');

    if (toggleBtn && menu) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.toggle('hidden');
        toggleBtn.setAttribute('aria-expanded', String(!isHidden));
      });

      document.addEventListener('click', () => {
        if (!menu.classList.contains('hidden')) {
          menu.classList.add('hidden');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    document.querySelectorAll('[data-lang-option]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang-option');
        if (lang && TRANSLATIONS[lang]) {
          currentLanguage = lang;
          try {
            localStorage.setItem('rewardzen_language', lang);
          } catch (e) {
            // ignore
          }
          applyTranslations();
          if (menu) menu.classList.add('hidden');
          if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* =========================================================================
   * 6. NAVBAR & MOBILE DRAWER
   * ========================================================================= */
  function initNavigation() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const drawer = document.getElementById('mobile-drawer');

    if (mobileBtn && drawer) {
      mobileBtn.addEventListener('click', () => {
        const hidden = drawer.classList.toggle('hidden');
        mobileBtn.setAttribute('aria-expanded', String(!hidden));
      });

      drawer.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          drawer.classList.add('hidden');
          mobileBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }

    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.forEach((l) => l.classList.remove('is-active'));
        link.classList.add('is-active');
      });
    });
  }

  /* =========================================================================
   * 7. INTERACTIVE PHONE MENU & EARNING OPPORTUNITIES SPOTLIGHT
   * ========================================================================= */
  function selectOpportunity(key) {
    const info = OPPORTUNITIES[key] || OPPORTUNITIES.surveys;
    document.querySelectorAll('[data-opp]').forEach((card) => {
      card.classList.toggle('is-selected', card.getAttribute('data-opp') === key);
    });

    const titleEl = document.getElementById('opp-detail-title');
    const descEl = document.getElementById('opp-detail-desc');
    const payoutEl = document.getElementById('opp-detail-payout');
    if (titleEl) titleEl.textContent = info.title;
    if (descEl) descEl.textContent = info.desc;
    if (payoutEl) payoutEl.textContent = info.payout;
  }

  function initOpportunitiesAndPhone() {
    document.querySelectorAll('[data-opp]').forEach((card) => {
      card.addEventListener('click', () => {
        const key = card.getAttribute('data-opp');
        selectOpportunity(key);
      });
    });

    document.querySelectorAll('[data-phone-item]').forEach((item) => {
      item.addEventListener('click', () => {
        document.querySelectorAll('[data-phone-item]').forEach((el) => el.classList.remove('is-active'));
        item.classList.add('is-active');
        const key = item.getAttribute('data-phone-item');
        if (key && OPPORTUNITIES[key]) {
          selectOpportunity(key);
        }
      });
    });
  }

  /* =========================================================================
   * 8. REAL APP SCREENSHOTS GALLERY & LIGHTBOX
   * ========================================================================= */
  function renderScreens() {
    const strip = document.getElementById('screens-strip');
    if (!strip) return;

    const list = activeScreenFilter === 'all'
      ? APP_SCREENSHOTS
      : APP_SCREENSHOTS.filter((s) => s.category === activeScreenFilter);

    strip.innerHTML = '';
    list.forEach((shot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'screen-card';
      btn.innerHTML =
        '<div class="screen-thumb-wrap">' +
          '<img class="screen-thumb" src="" alt="" loading="lazy" referrerpolicy="no-referrer" />' +
        '</div>' +
        '<div class="screen-title"></div>' +
        '<div class="screen-meta"></div>';

      const img = btn.querySelector('.screen-thumb');
      img.src = shot.image;
      img.alt = shot.title;
      btn.querySelector('.screen-title').textContent = shot.title;
      btn.querySelector('.screen-meta').textContent = shot.category;

      btn.addEventListener('click', () => openLightbox(shot));
      strip.appendChild(btn);
    });
  }

  function openLightbox(shot) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const title = document.getElementById('lightbox-title');
    const desc = document.getElementById('lightbox-desc');
    if (!modal) return;
    if (img) {
      img.src = shot.image;
      img.alt = shot.title;
    }
    if (title) title.textContent = shot.title;
    if (desc) desc.textContent = shot.desc;
    modal.classList.remove('hidden');
  }

  function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.classList.add('hidden');
  }

  function initShowcase() {
    document.querySelectorAll('[data-screen-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeScreenFilter = btn.getAttribute('data-screen-filter') || 'all';
        document.querySelectorAll('[data-screen-filter]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderScreens();
      });
    });

    const lbClose = document.getElementById('lightbox-close-btn');
    const lbModal = document.getElementById('lightbox-modal');
    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lbModal) {
      lbModal.addEventListener('click', (e) => {
        if (e.target === lbModal) closeLightbox();
      });
    }

    renderScreens();
  }

  /* =========================================================================
   * 9. MONTHLY EARNINGS ESTIMATOR
   * ========================================================================= */
  function updateCalculator() {
    const tasksSlider = document.getElementById('tasks-slider');
    const friendsSlider = document.getElementById('friends-slider');
    if (!tasksSlider || !friendsSlider) return;

    const tasks = Number(tasksSlider.value);
    const friends = Number(friendsSlider.value);
    const totalCoins = tasks * 15 * 30 + friends * 25;

    const tasksVal = document.getElementById('calc-tasks-val');
    const friendsVal = document.getElementById('calc-friends-val');
    const rupeesEl = document.getElementById('calc-total-rupees');
    const coinsEl = document.getElementById('calc-total-coins');

    if (tasksVal) tasksVal.textContent = tasks + ' / day';
    if (friendsVal) friendsVal.textContent = friends + ' friends';
    if (rupeesEl) rupeesEl.textContent = '₹' + totalCoins.toLocaleString('en-IN');
    if (coinsEl) coinsEl.textContent = totalCoins.toLocaleString('en-IN') + ' Coins';
  }

  function initCalculator() {
    const tasksSlider = document.getElementById('tasks-slider');
    const friendsSlider = document.getElementById('friends-slider');
    if (tasksSlider) tasksSlider.addEventListener('input', updateCalculator);
    if (friendsSlider) friendsSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  /* =========================================================================
   * 10. DOWNLOAD APK MODAL & PURE JS QR CODE
   * ========================================================================= */
  function getCurrentRelease() {
    return APK_RELEASES.find((r) => r.version === selectedApkVersion) || APK_RELEASES[0];
  }

  function getDynamicDownloadUrl() {
    const rel = getCurrentRelease();
    const origin =
      typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : 'https://rewardzen.vercel.app';
    return origin + '/?download=' + rel.version + '&auto=true';
  }

  function refreshQrCode() {
    const qrImg = document.getElementById('modal-qr-img');
    const rel = getCurrentRelease();
    const url = getDynamicDownloadUrl();
    try {
      currentQrDataUrl = PureQR.toDataURL(url, {
        width: 300,
        margin: 1.5,
        dark: '#160a38',
        light: '#ffffff'
      });
      if (qrImg) {
        qrImg.src = currentQrDataUrl;
        qrImg.alt = 'QR Code to download Rewardzen v' + rel.version;
      }
    } catch (e) {
      // ignore canvas errors
    }
  }

  function updateModalVersionUI() {
    const rel = getCurrentRelease();
    document.querySelectorAll('[data-version-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-version-btn') === selectedApkVersion);
    });
    const shaEl = document.getElementById('modal-sha256');
    const dlLabel = document.getElementById('modal-start-download-label');
    if (shaEl) shaEl.textContent = rel.sha256;
    if (dlLabel) dlLabel.textContent = 'Download ' + rel.filename + ' (' + rel.size + ')';
    refreshQrCode();
  }

  function setModalTab(tab) {
    document.querySelectorAll('[data-modal-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-modal-tab') === tab);
    });
    document.querySelectorAll('[data-modal-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.getAttribute('data-modal-panel') !== tab);
    });
    if (tab === 'qr') refreshQrCode();
  }

  function openDownloadModal(tab) {
    const modal = document.getElementById('download-modal');
    if (modal) modal.classList.remove('hidden');
    setModalTab(tab || 'download');
    updateModalVersionUI();
  }

  function closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    if (modal) modal.classList.add('hidden');
  }

  function triggerApkDownload(filename) {
    const link = document.createElement('a');
    link.href = './Rewardzen.apk';
    link.download = filename || 'Rewardzen.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function initDownloadModal() {
    document.querySelectorAll('[data-open-download]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openDownloadModal(btn.getAttribute('data-open-download') || 'download');
      });
    });

    const closeBtn = document.getElementById('modal-close-btn');
    const modal = document.getElementById('download-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeDownloadModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDownloadModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDownloadModal();
        closeLightbox();
      }
    });

    document.querySelectorAll('[data-modal-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setModalTab(btn.getAttribute('data-modal-tab')));
    });

    document.querySelectorAll('[data-version-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedApkVersion = btn.getAttribute('data-version-btn') || '2.4.0';
        updateModalVersionUI();
      });
    });

    const copyHashBtn = document.getElementById('modal-copy-hash');
    if (copyHashBtn) {
      copyHashBtn.addEventListener('click', () => {
        const rel = getCurrentRelease();
        if (navigator.clipboard) navigator.clipboard.writeText(rel.sha256);
        copyHashBtn.textContent = 'Copied';
        setTimeout(() => {
          copyHashBtn.textContent = 'Copy';
        }, 1800);
      });
    }

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
        let pct = 10;
        if (idleBox) idleBox.classList.add('hidden');
        if (progressBox) progressBox.classList.remove('hidden');
        if (progressFile) progressFile.textContent = 'Downloading ' + rel.filename + '...';
        if (progressPct) progressPct.textContent = pct + '%';
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressNote) progressNote.textContent = 'Preparing verified APK package...';

        if (downloadTimer) clearInterval(downloadTimer);
        downloadTimer = setInterval(() => {
          pct += 30;
          if (pct >= 100) {
            pct = 100;
            clearInterval(downloadTimer);
            downloadTimer = null;
            if (progressPct) progressPct.textContent = '100%';
            if (progressBar) progressBar.style.width = '100%';
            if (progressNote) progressNote.textContent = 'Download started — open Rewardzen.apk on Android.';
            triggerApkDownload(rel.filename);
            setTimeout(() => {
              if (progressBox) progressBox.classList.add('hidden');
              if (idleBox) idleBox.classList.remove('hidden');
            }, 1500);
          } else {
            if (progressPct) progressPct.textContent = pct + '%';
            if (progressBar) progressBar.style.width = pct + '%';
          }
        }, 180);
      });
    }

    const saveQrBtn = document.getElementById('modal-save-qr');
    if (saveQrBtn) {
      saveQrBtn.addEventListener('click', () => {
        if (!currentQrDataUrl) return;
        const link = document.createElement('a');
        link.href = currentQrDataUrl;
        link.download = 'Rewardzen-QR-v' + getCurrentRelease().version + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    }

    const copyLinkBtn = document.getElementById('modal-copy-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(getDynamicDownloadUrl());
        copyLinkBtn.textContent = 'Link Copied';
        setTimeout(() => {
          copyLinkBtn.textContent = 'Copy Link';
        }, 1800);
      });
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const dlVersion = params.get('download');
      if (dlVersion || params.get('scan') === 'true') {
        if (dlVersion === '2.3.8' || dlVersion === '2.4.0') selectedApkVersion = dlVersion;
        openDownloadModal('download');
        if (params.get('auto') === 'true') {
          triggerApkDownload(getCurrentRelease().filename);
        }
      }
    } catch (e) {
      // ignore invalid URL params
    }
  }

  /* =========================================================================
   * 11. BOOTSTRAP
   * ========================================================================= */
  function init() {
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    initLanguageSwitcher();
    initNavigation();
    initOpportunitiesAndPhone();
    initShowcase();
    initCalculator();
    initDownloadModal();
    applyTranslations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
