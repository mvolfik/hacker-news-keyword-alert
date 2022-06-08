import { Actor } from "apify";
import { gotScraping } from "got-scraping";
import ow from "ow";
import { TypeOfShape } from "ow/dist/utils/match-shape";
import { Log } from "@apify/log";

const responseSchema = ow.object.partialShape({
  hits: ow.array.ofType(
    ow.object.partialShape({
      author: ow.string,
      objectID: ow.string,
      comment_text: ow.any(ow.string, ow.null),
      title: ow.any(ow.string, ow.null),
      url: ow.any(ow.string, ow.null),
      story_title: ow.any(ow.string, ow.null),
      story_url: ow.any(ow.string, ow.null),
      story_text: ow.any(ow.string, ow.null),
    })
  ),
});

type ProcessedItem = Omit<
  TypeOfShape<typeof responseSchema>["hits"][0],
  "objectID"
> & { objectID: number };

const inputSchema = ow.object.exactShape({
  keyword: ow.string,
  email: ow.optional.string,
});

async function fetchPage(
  keyword: string,
  page: number
): Promise<ProcessedItem[]> {
  new Log().info("Fetching page", { page });
  const data = await gotScraping({
    url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
      keyword
    )}&typoTolerance=false&page=${page}`,
    parseJson: JSON.parse,
  }).json();
  ow(data, responseSchema);
  return data.hits
    .map((item) => ({ ...item, objectID: parseInt(item.objectID) }))
    .sort((a, b) => a.objectID - b.objectID);
}

function cleanupText(t: string): string {
  return t
    .replaceAll("<p>", "\n")
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replaceAll(
      /<a href="([^"]+)" rel="nofollow">([^"]+)<\/a>/g,
      (_, url, text) => (url === text ? url : `[${text}](${url})`)
    )
    .split("\n")
    .map((line) => {
      const { lines, current } = line
        .split(" ")
        .reduce<{ lines: string[]; current: string }>(
          ({ lines, current }, next) => {
            if (current.length + next.length > 80) {
              lines.push(current.trim());
              return { lines, current: next };
            }
            return { lines, current: `${current} ${next}` };
          },
          { lines: [], current: "" }
        );
      return [...lines, current.trim()]
        .map((l) => "  " + l)
        .join("\n")
        .trimEnd();
    })
    .join("\n\n");
}

Actor.main(async () => {
  const input = await Actor.getInput();
  ow(input, inputSchema);
  const KV = await Actor.openKeyValueStore("hn-search-alert");
  const lastSeenItemKVKey = `LAST_SEEN_ITEM_${input.keyword.replaceAll(
    /[^a-zA-Z0-9]/g,
    ""
  )}`;
  const lastSeenItemString = await KV.getValue<string>(lastSeenItemKVKey);
  const lastSeenItem = lastSeenItemString ? parseInt(lastSeenItemString) : null;

  let items: ProcessedItem[] = [];
  let page = 0;
  let previousLastSeenIndex = -2;
  while (previousLastSeenIndex === -2) {
    items.push(...(await fetchPage(input.keyword, page)));
    previousLastSeenIndex =
      lastSeenItem === null
        ? -1
        : items.findIndex((item) => item.objectID > lastSeenItem) - 1;
    page += 1;
  }
  const newItems = items.slice(previousLastSeenIndex + 1);
  await Actor.pushData(newItems);

  const text =
    `**New mentions of '${input.keyword}' on Hacker news**\n\n\n` +
    newItems
      .map((item) => {
        let text;
        if (item.comment_text !== null) {
          const optionalLink = item.story_url ? ` (${item.story_url})` : "";
          text =
            `A comment by ${item.author} on post ${item.story_title}${optionalLink}:\n` +
            cleanupText(item.comment_text);
        } else {
          text = `'${item.title}' posted by ${item.author} (${
            item.url ?? "no link"
          })`;
          if (item.story_text !== null) {
            text += `:\n${cleanupText(item.story_text)}`;
          }
        }
        text +=
          "\nHN link: https://news.ycombinator.com/item?id=" + item.objectID;
        return text;
      })
      .join("\n\n\n");
  const setLastSeenItemPromise = KV.setValue(
    lastSeenItemKVKey,
    items.at(-1)?.objectID.toString(),
    { contentType: "text/plain" }
  );
  if (input.email) {
    await Promise.all([
      setLastSeenItemPromise,
      Actor.call("apify/send-mail", {
        to: input.email,
        subject: `New mentions of '${input.keyword}' on HN`,
        text,
      }),
    ]);
  } else {
    console.info(text);
    await Promise.all([
      setLastSeenItemPromise,
      Actor.setValue("OUTPUT", text, { contentType: "text/plain" }),
    ]);
  }
});
