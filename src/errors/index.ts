export interface ExtErrorProps {
	hide?: boolean;
	system?: boolean;
}
const ExtErrorProp = Symbol(`Verda::ExtError::PropertySingle`);
export type ExtError = Error & { [ExtErrorProp]: ExtErrorProps };
export function createExtError(err: Error, ext: ExtErrorProps): ExtError {
	return Object.assign(err, { [ExtErrorProp]: ext });
}
export function getExtErrorProps(err: Error): ExtErrorProps | undefined {
	if (!err) return undefined;
	return (err as any)[ExtErrorProp];
}
