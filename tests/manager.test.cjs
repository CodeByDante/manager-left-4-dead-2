const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Manager } = require('../app/services/manager.cjs');
const { parseKeyValues, searchPaths, safeChild, updateLaunchOptions } = require('../app/services/files.cjs');
const { discoverGame, accounts, createWorkshop } = require('../app/services/steam.cjs');
const INITIAL = '"GameInfo"\n{\n "FileSystem"\n {\n  "SearchPaths"\n  {\n   Game update\n   Game left4dead2_dlc3\n   Game "|gameinfo_path|."\n   Game My_Handmade_Mod // manual folder\n  }\n }\n}\n';
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l4d2-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'game'); const data = path.join(dir, 'data');
  fs.mkdirSync(path.join(root, 'left4dead2', 'addons', 'workshop'), { recursive: true });
  fs.mkdirSync(path.join(root, 'My_Handmade_Mod'));
  const gameinfo = path.join(root, 'left4dead2', 'gameinfo.txt'); fs.writeFileSync(gameinfo, INITIAL);
  const trashed = [];
  const manager = new Manager(data, async target => { trashed.push(target); fs.renameSync(target, target + '.trashed'); });
  manager.selectGame(root);
  const vpk = Buffer.alloc(12); vpk.writeUInt32LE(0x55aa1234); vpk.writeUInt32LE(1, 4);
  fs.writeFileSync(path.join(manager.workshopDir, '123.vpk'), vpk);
  return { manager, root, data, dir, gameinfo, trashed };
}
test('KeyValues respects quoted comments/braces and rejects unbalanced config', () => {
  const entries = parseKeyValues('root { "value" "https://host/{value}" // comment\n nested { key "a\\"b" } }');
  assert.equal(entries[0].entries[0].value, 'https://host/{value}');
  assert.equal(entries[0].entries[1].entries[0].value, 'a"b');
  assert.throws(() => parseKeyValues('root { key value'), /Falta/);
});
test('custom mods are read from actual SearchPaths; no sample folders', t => {
  const { manager } = fixture(t); const mods = manager.gameinfoMods();
  assert.deepEqual(mods.map(m => m.name), ['My_Handmade_Mod']);
  assert.equal(mods[0].kind, 'manual'); assert.equal(mods[0].exists, true); assert.equal(mods[0].managed, false);
});
test('conversion copies VPK, backs up config, registers once, preserves original', t => {
  const { manager, root, gameinfo } = fixture(t);
  manager.convert({ id: '123', filename: '123.vpk' });
  assert.ok(fs.existsSync(path.join(root, 'Workshop_123', 'pak01_dir.vpk')));
  assert.ok(fs.existsSync(path.join(manager.workshopDir, '123.vpk')));
  assert.equal(searchPaths(fs.readFileSync(gameinfo, 'utf8')).entries.filter(e => e.value === 'Workshop_123').length, 1);
  assert.equal(manager.gameinfoMods().find(m => m.id === '123').kind, 'workshop');
  assert.equal(manager.listBackups().length, 1);
  assert.throws(() => manager.convert({ id: '123', filename: '123.vpk' }), /ya tiene/);
});
test('invalid VPK rolls back staging and leaves gameinfo unchanged', t => {
  const { manager, root, gameinfo } = fixture(t);
  fs.writeFileSync(path.join(manager.workshopDir, '456.vpk'), 'invalid');
  assert.throws(() => manager.convert({ id: '456', filename: '456.vpk' }), /VPK válido/);
  assert.equal(fs.readFileSync(gameinfo, 'utf8'), INITIAL);
  assert.ok(!fs.readdirSync(root).some(n => n.startsWith('.l4d2-') || n === 'Workshop_456'));
});
test('manual mod removal preserves manually moved files', async t => {
  const { manager, root, trashed } = fixture(t);
  await manager.remove({ name: 'My_Handmade_Mod' });
  assert.ok(fs.existsSync(path.join(root, 'My_Handmade_Mod')));
  assert.equal(trashed.length, 0); assert.equal(manager.gameinfoMods().length, 0);
});
test('managed mod removal uses trash and restores config from backup', async t => {
  const { manager, root, gameinfo, trashed } = fixture(t);
  manager.convert({ id: '123', filename: '123.vpk' });
  const convertedText = fs.readFileSync(gameinfo, 'utf8');
  await manager.remove({ name: 'Workshop_123' });
  assert.deepEqual(trashed, [path.join(root, 'Workshop_123')]);
  const backup = manager.listBackups().find(b => fs.readFileSync(path.join(manager.backups, b.id + '.bak'), 'utf8') === convertedText);
  manager.restore({ id: backup.id });
  assert.equal(fs.readFileSync(gameinfo, 'utf8'), convertedText);
});
test('path traversal, core removal, and tampered IDs cannot modify arbitrary files', async t => {
  const { manager, root, gameinfo } = fixture(t);
  assert.throws(() => safeChild(root, '../outside'), /permitido|sale/);
  assert.throws(() => safeChild(root, 'C:\\outside'), /permitido/);
  assert.throws(() => manager.convert({ id: '../123', filename: '123.vpk' }));
  assert.throws(() => manager.toggle({ filename: '../file.vpk' }));
  await assert.rejects(manager.remove({ name: 'update' }), /base/);
  assert.equal(fs.readFileSync(gameinfo, 'utf8'), INITIAL);
});
test('saving gameinfo validates structure and supports recovery', t => {
  const { manager, gameinfo } = fixture(t);
  assert.throws(() => manager.saveConfig({ kind: 'gameinfo', content: 'GameInfo {' }));
  assert.equal(fs.readFileSync(gameinfo, 'utf8'), INITIAL);
  manager.saveConfig({ kind: 'gameinfo', content: INITIAL.replace('My_Handmade_Mod', 'Other_Mod') });
  manager.restore({ id: manager.listBackups()[0].id });
  assert.equal(fs.readFileSync(gameinfo, 'utf8'), INITIAL);
});
test('launch options update app 550 only, even when another app has launch options', () => {
  const text = 'UserLocalConfigStore { Software { Valve { Steam { apps { "550" { "LastPlayed" "55" } "730" { "LaunchOptions" "KEEP" } } } } } }';
  const updated = updateLaunchOptions(text, '-console +exec "my config.cfg"');
  const apps = parseKeyValues(updated)[0].entries[0].entries[0].entries[0].entries[0].entries;
  assert.equal(apps[0].entries.find(e => e.key === 'LaunchOptions').value, '-console +exec "my config.cfg"');
  assert.equal(apps[1].entries[0].value, 'KEEP');
  assert.throws(() => updateLaunchOptions(text, 'bad\nvalue'));
});
test('Steam library discovery detects a game outside the Steam program folder', t => {
  const { dir, root } = fixture(t); const steam = path.join(dir, 'Steam');
  fs.mkdirSync(path.join(steam, 'steamapps'), { recursive: true });
  const library = path.join(dir, 'Library');
  const destination = path.join(library, 'steamapps', 'common', 'Left 4 Dead 2');
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.cpSync(root, destination, { recursive: true });
  fs.writeFileSync(path.join(steam, 'steamapps', 'libraryfolders.vdf'), `libraryfolders { "1" { path "${library}" } }`);
  assert.equal(discoverGame([steam]), destination);
});
test('empty Workshop stays empty and does not require network', async t => {
  const { manager } = fixture(t); fs.unlinkSync(path.join(manager.workshopDir, '123.vpk'));
  const result = await manager.workshopMods(); assert.deepEqual(result.mods, []);
});
test('Steam account selection uses app 550 data rather than adjacent app data', t => {
  const { dir } = fixture(t); const steam = path.join(dir, 'Steam');
  fs.mkdirSync(path.join(steam, 'userdata', '42', 'config'), { recursive: true });
  fs.writeFileSync(path.join(steam, 'userdata', '42', 'config', 'localconfig.vdf'), 'root { apps { "550" { LastPlayed 100 } "730" { LaunchOptions wrong LastPlayed 9999 } } }');
  assert.equal(accounts(steam)[0].lastPlayed, 100); assert.equal(accounts(steam)[0].launchOptions, '');
});
test('failed requirements lookup is reported as unverified, not no dependencies', async t => {
  const { data } = fixture(t); const previous = global.fetch;
  global.fetch = async () => { throw new Error('offline'); }; t.after(() => { global.fetch = previous; });
  const result = await createWorkshop(data).requirements('123'); assert.equal(result.verified, false);
});
test('a manual folder with a numeric suffix stays a custom mod', t => {
  const { manager, root, gameinfo } = fixture(t);
  fs.mkdirSync(path.join(root, 'My_Mod_2026'));
  fs.writeFileSync(gameinfo, INITIAL.replace('My_Handmade_Mod', 'My_Mod_2026'));
  assert.equal(manager.gameinfoMods()[0].kind, 'manual');
});
test('trash failure restores the managed mod registration and preserves files', async t => {
  const { manager, root, gameinfo } = fixture(t);
  manager.convert({ id: '123', filename: '123.vpk' });
  const before = fs.readFileSync(gameinfo, 'utf8');
  manager.trash = async () => { throw new Error('Access denied'); };
  await assert.rejects(manager.remove({ name: 'Workshop_123' }), /restauró/);
  assert.equal(fs.readFileSync(gameinfo, 'utf8'), before);
  assert.ok(fs.existsSync(path.join(root, 'Workshop_123', 'pak01_dir.vpk')));
});
test('VPK toggle is reversible and never overwrites a destination file', t => {
  const { manager } = fixture(t);
  manager.toggle({ filename: '123.vpk' });
  assert.ok(fs.existsSync(path.join(manager.workshopDir, '123.vpk.disabled')));
  manager.toggle({ filename: '123.vpk.disabled' });
  assert.ok(fs.existsSync(path.join(manager.workshopDir, '123.vpk')));
  fs.writeFileSync(path.join(manager.workshopDir, '123.vpk.disabled'), 'keep');
  assert.throws(() => manager.toggle({ filename: '123.vpk' }), /Ya existe/);
  assert.equal(fs.readFileSync(path.join(manager.workshopDir, '123.vpk.disabled'), 'utf8'), 'keep');
});
test('multipart VPK requires and copies its referenced segments', t => {
  const { manager, root } = fixture(t);
  const words = Buffer.from('txt\0 \0file\0');
  const entry = Buffer.alloc(18); entry.writeUInt16LE(0, 6); entry.writeUInt32LE(3, 12); entry.writeUInt16LE(0xffff, 16);
  const tree = Buffer.concat([words, entry, Buffer.from([0, 0, 0])]);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x55aa1234); header.writeUInt32LE(1, 4); header.writeUInt32LE(tree.length, 8);
  fs.writeFileSync(path.join(manager.workshopDir, '777_dir.vpk'), Buffer.concat([header, tree]));
  assert.throws(() => manager.convert({ id: '777', filename: '777_dir.vpk' }), /Falta el segmento/);
  fs.writeFileSync(path.join(manager.workshopDir, '777_000.vpk'), 'abc');
  manager.convert({ id: '777', filename: '777_dir.vpk' });
  assert.equal(fs.readFileSync(path.join(root, 'Workshop_777', 'pak01_000.vpk'), 'utf8'), 'abc');
});
