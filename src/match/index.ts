import posixifyPath from "./posixify-path";

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

export function globToRegex(str: string) {
	let reStr = "";

	let inCharClass = false;
	let escaped = false;

	for (var i = 0, len = str.length; i < len; i++) {
		const c = str[i];
		if (inCharClass) {
			if (escaped) {
				reStr += escapeRegExp(c);
				escaped = false;
			} else if (c === "\\") {
				escaped = true;
			} else if (c === "]") {
				reStr += "]";
				inCharClass = false;
			} else {
				reStr += c;
			}
			continue;
		}
		if (escaped) {
			reStr += escapeRegExp(c);
			escaped = false;
			continue;
		}
		switch (c) {
			case "\\":
				escaped = true;
				break;

			case "?":
				reStr += ".";
				break;

			case "[":
				reStr += "[";
				inCharClass = true;
				break;

			case "]":
				reStr += "]";
				inCharClass = false;
				break;

			case "{":
				reStr += "(";
				break;

			case "}":
				reStr += ")";
				break;

			case "|":
				reStr += "|";
				break;

			case "*":
				const prevChar = str[i - 1];
				let starCount = 1;
				while (str[i + 1] === "*") {
					starCount++;
					i++;
				}
				const nextChar = str[i + 1];

				const isExtended = starCount > 2;
				const isGlobStar =
					starCount === 2 &&
					(prevChar === "/" || prevChar === ":" || prevChar === undefined) &&
					(nextChar === "/" || nextChar === undefined);

				if (isExtended) {
					reStr += "(.*)";
				} else if (isGlobStar) {
					// it's a globStar, so match zero or more path segments
					reStr += "((?:[^/:]*(?:[/:]|$))*)";
					i++; // move over the "/"
				} else {
					// it's not a globStar, so only match one path segment
					reStr += "([^/:]*)";
				}
				break;

			default:
				reStr += escapeRegExp(c);
		}
	}

	reStr = "^(?:" + reStr + ")$";
	return new RegExp(reStr);
}

export function PatternMatch(pattern) {
	const regex = globToRegex(pattern);
	return function(s: string) {
		const posixPath = posixifyPath(s);
		const m = posixPath.match(regex);
		if (!m) return m;
		else return m.slice(1);
	};
}
