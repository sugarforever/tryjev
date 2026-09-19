// The deployed origin is only known at request time; the layout builds canonical / og:url from it.
export const load = ({ url }) => ({ origin: url.origin });
