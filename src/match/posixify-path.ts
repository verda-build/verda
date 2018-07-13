import * as path from "path";
export default function posixifyPath(p: string) {
	return p.split(path.sep).join("/");
}
