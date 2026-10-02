/* =====================================================================
 * NET — the link between the two players of a challenge.
 * ---------------------------------------------------------------------
 * The game is a static site (GitHub Pages), so there is no server of
 * our own. Messages go through a public MQTT relay over secure
 * WebSockets: both phones only make outgoing connections, so it works
 * on mobile data and behind any router (no peer-to-peer NAT problems).
 *
 * A room is a 6-character code: 5 random characters + 1 digit that says
 * which relay the host used, so the guest connects to the same one.
 *   topic  limonat/v1/<room>/h   host  -> guest
 *          limonat/v1/<room>/g   guest -> host
 *
 * Tests can point at a local relay with ?relay=ws://127.0.0.1:8899
 * ===================================================================== */
(function () {
  const RELAYS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
  ];
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
  const PREFIX = 'limonat/v1/';

  function relayList() {
    try {
      const o = new URLSearchParams(location.search).get('relay');
      if (o) return [o];
    } catch (e) { /* no URL */ }
    return RELAYS;
  }
  function randomCode(n) {
    const a = new Uint32Array(n); (window.crypto || window.msCrypto).getRandomValues(a);
    let s = ''; for (let i = 0; i < n; i++) s += ALPHABET[a[i] % ALPHABET.length]; return s;
  }
  function cleanCode(text) {
    return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').slice(0, 6);
  }
  function validCode(code) {
    if (code.length !== 6) return false;
    for (let i = 0; i < 5; i++) if (!ALPHABET.includes(code[i])) return false;
    return +code[5] < relayList().length;
  }

  class Link {
    constructor() {
      this.client = null; this.role = null; this.room = null;
      this.id = randomCode(8);
      this.handlers = {};
      this.connected = false;
    }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    emit(ev, a) { (this.handlers[ev] || []).forEach(fn => { try { fn(a); } catch (e) { console.error(e); } }); }

    /** Host: find a relay that answers, make a room on it. Resolves with the room code. */
    async host() {
      const list = relayList();
      for (let i = 0; i < list.length; i++) {
        const room = randomCode(5) + i;
        try { await this.open(list[i], room, 'h'); return room; }
        catch (e) { console.warn('[net] relay failed', list[i], e && e.message); this.close(); }
      }
      throw new Error('no-relay');
    }
    /** Guest: join the room on the relay the code names. */
    async join(code) {
      const room = cleanCode(code);
      if (!validCode(room)) throw new Error('bad-code');
      await this.open(relayList()[+room[5]], room, 'g');
      return room;
    }

    open(url, room, role) {
      if (typeof mqtt === 'undefined') return Promise.reject(new Error('no-mqtt'));
      this.room = room; this.role = role;
      const mine = PREFIX + room + '/' + role, theirs = PREFIX + room + '/' + (role === 'h' ? 'g' : 'h');
      this.topicOut = mine;
      return new Promise((resolve, reject) => {
        let settled = false;
        const client = mqtt.connect(url, {
          clientId: 'limonat_' + this.id + '_' + randomCode(4),
          clean: true, keepalive: 15, reconnectPeriod: 2000, connectTimeout: 7000,
          will: { topic: mine, payload: JSON.stringify({ t: 'bye', from: this.id }), qos: 0, retain: false },
        });
        this.client = client;
        const fail = (err) => { if (!settled) { settled = true; reject(err || new Error('connect')); } };
        const timer = setTimeout(() => fail(new Error('timeout')), 8000);
        client.on('connect', () => {
          client.subscribe(theirs, { qos: 0 }, (err) => {
            if (err) return fail(err);
            this.connected = true;
            this.emit('online', true);
            if (!settled) { settled = true; clearTimeout(timer); resolve(); }
          });
        });
        client.on('message', (topic, buf) => {
          if (topic !== theirs) return;
          let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
          if (!m || m.from === this.id) return;
          this.emit('message', m);
        });
        client.on('error', (e) => { if (!settled) { clearTimeout(timer); fail(e); } });
        client.on('offline', () => { this.connected = false; this.emit('online', false); });
        client.on('close', () => { if (this.connected) { this.connected = false; this.emit('online', false); } });
      });
    }

    send(msg) {
      if (!this.client || !this.connected) return false;
      msg.from = this.id;
      this.client.publish(this.topicOut, JSON.stringify(msg), { qos: 0 });
      return true;
    }

    close(sayBye) {
      const c = this.client; this.client = null;
      if (!c) return;
      if (sayBye && this.connected) {
        try { c.publish(this.topicOut, JSON.stringify({ t: 'bye', from: this.id }), { qos: 0 }); } catch (e) { /* closing */ }
      }
      this.connected = false;
      try { c.end(false); } catch (e) { /* already closed */ }
    }
  }

  VR.Net = { Link, cleanCode, validCode, relayList, randomCode, PREFIX };
})();
