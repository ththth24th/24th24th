import test from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  componentOf,
  defaults,
  partsOf,
  platforms,
  validateConfig,
} from "../src/lab/data";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
test("eight platforms have their distinct propulsion and airplane geometry contracts", () => {
  assert.equal(platforms.length, 8);
  assert.equal(new Set(platforms.map((p) => p.name)).size, 8);
  for (const p of platforms) {
    const parts = partsOf(defaults(p.id));
    assert.equal(
      parts.filter((x) => x.component.category === "motor").length,
      p.motors,
    );
    assert.equal(
      parts.filter((x) => x.component.category === "propeller").length,
      p.motors,
    );
    assert.ok(calculate(defaults(p.id)).mass > 0);
  }
  assert.equal(
    partsOf(defaults("wing")).filter((x) => x.visual === "motor").length,
    0,
  );
  assert.equal(
    partsOf(defaults("hybrid")).filter((x) => x.visual === "motor").length,
    4,
  );
});
test("tank volume changes physical dimensions, empty mass, liquid mass and full mass", () => {
  const c = defaults("agro"),
    a = calculate(c),
    b = calculate({ ...c, tank: 15 });
  close(b.mass - a.mass, 5 + 5 * 0.055);
  assert.ok(
    componentOf("tank-15").dimensions[0] > componentOf("tank-10").dimensions[0],
  );
  close(b.fullTank, b.mass);
  assert.equal(b.parts.filter((x) => x.visual === "nozzle").length, 4);
});
test("tank fill removes only liquid mass and the full-tank figure remains stable", () => {
  const c = defaults("agro"),
    full = calculate(c),
    half = calculate({ ...c, fill: 50 }),
    empty = calculate({ ...c, fill: 0 });
  close(full.mass - half.mass, 5);
  close(full.mass - empty.mass, 10);
  close(half.fullTank, full.fullTank);
  close(empty.fullTank, full.fullTank);
  close(empty.mass, empty.dry);
});
test("cargo mass affects total mass, reserve, power and endurance", () => {
  const c = defaults("cargo"),
    a = calculate({ ...c, cargo: 0 }),
    b = calculate({ ...c, cargo: 10 });
  close(b.mass - a.mass, 10);
  close(b.dry, a.dry);
  assert.ok(b.reserve < a.reserve);
  assert.ok(b.power > a.power);
  assert.ok(b.minutes < a.minutes);
  assert.ok(calculate({ ...c, cargo: 20 }).warnings.length > 0);
});
test("battery energy follows nominal voltage and capacity; available fraction is explicit", () => {
  const c = defaults("geo"),
    a = calculate({ ...c, battery: "bat-light" }),
    b = calculate(c);
  close(b.energy, 22.2 * 10);
  close(b.available, b.energy * 0.8);
  close(b.minutes, (b.available / b.power) * 60);
  assert.ok(b.available > a.available);
  assert.ok(b.minutes > a.minutes);
});
test("components and nozzles contribute mass and auxiliary power exactly once", () => {
  const c = defaults("agro"),
    a = calculate({ ...c, nozzles: 2 }),
    b = calculate({ ...c, nozzles: 6 });
  close(b.mass - a.mass, 4 * 0.06);
  close(b.aux - a.aux, 4 * 2);
  const geo = defaults("geo"),
    base = calculate(geo),
    lidar = calculate({ ...geo, modules: ["lidar"] });
  close(lidar.mass - base.mass, 0.65);
  close(lidar.aux - base.aux, 22);
});
test("center of mass is the weighted sum of installed part positions", () => {
  const m = calculate({ ...defaults("cargo"), cargo: 8 });
  for (let i = 0; i < 3; i++)
    close(
      m.center[i],
      m.parts.reduce((s, p) => s + p.component.mass * p.position[i], 0) /
        m.mass,
    );
  assert.ok(m.center[1] < 0);
});
test("airplane wing span changes mass and dimensions; cruise exponent is linear", () => {
  const c = defaults("wing"),
    a = calculate({ ...c, wingSpan: 2.4 }),
    b = calculate({ ...c, wingSpan: 3.6 });
  assert.equal(a.size[0], 2.4);
  assert.equal(b.size[0], 3.6);
  assert.ok(b.mass > a.mass);
  close(b.propulsion / a.propulsion, b.mass / a.mass);
});
test("scenario scales propulsion without scaling auxiliary electronics", () => {
  const c = defaults("rescue"),
    a = calculate(c),
    b = calculate({ ...c, scenario: 1.3 });
  close(b.propulsion, a.propulsion * 1.3);
  close(a.aux, b.aux);
  assert.ok(b.minutes < a.minutes);
});
test("all default configurations are compatible and fit educational constraints", () => {
  for (const p of platforms) {
    const c = defaults(p.id);
    assert.deepEqual(validateConfig(c), c);
    assert.deepEqual(calculate(c).warnings, [], p.name);
  }
});
test("JSON validation rejects incompatible components, unknown IDs, duplicate modules and invalid numbers", () => {
  const c = defaults("geo");
  for (const bad of [
    { ...c, battery: "bat-heavy" },
    { ...c, camera: "zoom" },
    { ...c, sensors: ["unknown"] },
    { ...c, sensors: ["gnss", "gnss"] },
    { ...c, modules: ["pump"] },
    { ...c, fill: Infinity },
    { ...c, cargo: -1 },
    { ...c, scenario: 0 },
    { ...c, tank: 17 },
    null,
  ])
    assert.throws(() => validateConfig(bad));
});
test("configuration JSON round trip preserves calculations and strips unknown fields", () => {
  const c = { ...defaults("agro"), fill: 34, tank: 15, nozzles: 6 };
  const restored = validateConfig(
    JSON.parse(JSON.stringify({ ...c, untrusted: "removed" })),
  );
  assert.deepEqual(restored, c);
  assert.deepEqual(calculate(restored), calculate(c));
});
