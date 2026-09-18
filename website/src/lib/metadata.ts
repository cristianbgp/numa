export const SITE_URL = "https://numa.channel";

export const DEFAULT_DESCRIPTION =
  "numa is a series of minimalist sound journals. each mix captures a single feeling, a moment in time. created for calm spaces and unhurried hours.";

type PageMetadataInput = {
  pathname: string;
  title: string;
  description?: string;
  image?: string;
};

export function createPageMetadata({
  pathname,
  title,
  description = DEFAULT_DESCRIPTION,
  image = "/og/numa.png",
}: PageMetadataInput) {
  const canonicalUrl = new URL(pathname, SITE_URL);
  canonicalUrl.search = "";
  canonicalUrl.hash = "";

  return {
    title,
    description,
    canonicalUrl: canonicalUrl.toString(),
    imageUrl: new URL(image, SITE_URL).toString(),
  };
}
