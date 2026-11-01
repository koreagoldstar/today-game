/* 맵 고르기 */
import { buildCity } from "./city.js";
import { buildHarbor } from "./harbor.js";
import { buildDesert } from "./desert.js";
import { buildBase } from "./base.js";
import { TREES } from "./common.js";

export function buildEnv(spec) {
  TREES.list = [];
  const make = { city: buildCity, harbor: buildHarbor, desert: buildDesert, base: buildBase }[spec.map] || buildCity;
  const env = make(spec);
  env.treeSpheres = TREES.list;
  return env;
}
