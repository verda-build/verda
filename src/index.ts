import { getEnv, setEnv } from "./default-env";

export = { ...getEnv(), configure: setEnv };
