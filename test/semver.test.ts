/* 
SPDX-FileCopyrightText: 2023 Kevin de Jong <monkaii@hotmail.com>

SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SemVer } from "../src/semver";
import * as semver from "../src/semver";

describe("String to SemVer", () => {
  test("Versions", () => {
    const versions = [
      "0.0.1",
      "0.1.0",
      "0.1.1-rc.1",
      "0.1.1",
      "0.2.0",
      "1.0.0-rc.1",
      "1.0.0-rc.1+build.1",
      "1.0.0-rc.1+build.2",
      "1.0.0-rc.2",
      "1.0.0",
    ];
    versions.forEach(v => {
      expect(new SemVer(v).toString()).toBe(v);
    });
  });

  test("Bad Versions", () => {
    const versions = ["0.0.1.1", "0.1.x", "0.1.1?rc.1", "v87", "2023-02-02"];
    versions.forEach(v => {
      expect(() => {
        new SemVer(v);
      }).toThrow();
    });
  });
});

describe("Sort SemVer", () => {
  test("Order SemVer", () => {
    const versions = [
      new SemVer("1.0.0-rc.1+build.1"),
      new SemVer("0.1.0"),
      new SemVer("2.0.0+random"),
      new SemVer("1.0.0"),
      new SemVer("0.1.1"),
      new SemVer("1.0.0-rc.1"),
      new SemVer("0.0.1"),
      new SemVer("0.1.1-rc.1"),
      new SemVer("0.2.0"),
      new SemVer("1.0.0-rc.3"),
      new SemVer("1.0.0"),
      new SemVer("1.0.0-rc.1+build.2"),
      new SemVer("1.0.0-rc.2"),
    ];
    const sorted = versions.sort(semver.sortSemVer);
    expect(sorted.map(v => v.toString())).toStrictEqual([
      "0.0.1",
      "0.1.0",
      "0.1.1-rc.1",
      "0.1.1",
      "0.2.0",
      "1.0.0-rc.1+build.1",
      "1.0.0-rc.1+build.2",
      "1.0.0-rc.1",
      "1.0.0-rc.2",
      "1.0.0-rc.3",
      "1.0.0",
      "1.0.0",
      "2.0.0+random",
    ]);
  });
});

describe("Bump version", () => {
  test("Bump major", () => {
    expect(new SemVer("0.0.1").bump("major").toString()).toBe("1.0.0");
    expect(new SemVer("0.1.0").bump("major").toString()).toBe("1.0.0");
    expect(new SemVer("1.0.0").bump("major").toString()).toBe("2.0.0");
    expect(new SemVer("1.0.0-rc.1").bump("major").toString()).toBe("2.0.0");
    expect(new SemVer("1.0.0-rc.2+build.1").bump("major").toString()).toBe("2.0.0");
  });

  test("Bump minor", () => {
    expect(new SemVer("0.0.1").bump("minor").toString()).toBe("0.1.0");
    expect(new SemVer("0.1.0").bump("minor").toString()).toBe("0.2.0");
    expect(new SemVer("1.0.0").bump("minor").toString()).toBe("1.1.0");
    expect(new SemVer("1.0.0-rc.1").bump("minor").toString()).toBe("1.1.0");
    expect(new SemVer("1.0.0-rc.2+build.1").bump("minor").toString()).toBe("1.1.0");
  });

  test("Bump patch", () => {
    expect(new SemVer("0.0.1").bump("patch").toString()).toBe("0.0.2");
    expect(new SemVer("0.1.0").bump("patch").toString()).toBe("0.1.1");
    expect(new SemVer("1.0.0").bump("patch").toString()).toBe("1.0.1");
    expect(new SemVer("1.0.0-rc.1").bump("patch").toString()).toBe("1.0.1");
    expect(new SemVer("1.0.0-rc.2+build.1").bump("patch").toString()).toBe("1.0.1");
  });

  test("Bump preRelease", () => {
    expect(new SemVer("0.0.1").bump("preRelease").toString()).toBe("0.0.1-rc.1");
    expect(new SemVer("0.1.0-rc.1").bump("preRelease").toString()).toBe("0.1.0-rc.2");
    expect(new SemVer("1.0.0+build.3").bump("preRelease").toString()).toBe("1.0.0-rc.1");
    expect(new SemVer("1.0.0-rc.2+build.1").bump("preRelease").toString()).toBe("1.0.0-rc.3");
  });

  test("Bump build", () => {
    expect(new SemVer("0.0.1").bump("build").toString()).toBe("0.0.1+build.1");
    expect(new SemVer("0.1.0-rc.1").bump("build").toString()).toBe("0.1.0-rc.1+build.1");
    expect(new SemVer("1.0.0+build.1").bump("build").toString()).toBe("1.0.0+build.2");
    expect(new SemVer("1.0.0-rc.2+build.1").bump("build").toString()).toBe("1.0.0-rc.2+build.2");
  });

  test("Choo choo, bump train", () => {
    expect(
      new SemVer("0.0.0").bump("major").bump("minor").bump("patch").bump("preRelease").bump("build").toString()
    ).toBe("1.1.1-rc.1+build.1");
    expect(
      new SemVer("0.0.0").bump("build").bump("preRelease").bump("patch").bump("minor").bump("major").toString()
    ).toBe("1.0.0");
  });
});
