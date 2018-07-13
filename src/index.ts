import { getEnv, setEnv } from "./default-env";
import { Arguments } from "yargs";

export = { ...getEnv(), configure: setEnv };
