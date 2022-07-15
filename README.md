# Hacker News keyword alert

Hacker News keyword alert is an actor for the Apify platform that allows you to get notified whenever a given keyword is mentioned in a Hacker News post or comment.

This is especially useful for brands – this actor enables you to catch and reply to negative mentions of your company before they get viral, and you have no chance of responding without your reply drowning in the storm.

## Usage

For experienced Apify users: just set a schedule executing this actor regularly and either provide an email in actor input, or use some integration.

### Step by step setup

1. [Open this actor in the Apify Console][actor-in-console] (you will need to create an account if you don't have one).
2. In the top right, open the _Actions_ dropdown and select _Schedule actor_. After you choose a name for your schedule, you will be presented with a schedule edit page.
3. Setup the schedule frequency: click the _Change_ button next under the _Schedule_ header.
   - If you choose _Custom_ occurence, you can set a more specific frequency like _every X minutes_.
4. Save the frequency setting.
5. Switch to the _Actors and Tasks_ tab.
6. This scraper will be already pre-configured there – click _Edit_ to setup the target keyword.
7. Set the keyword to receive notifications for, and the email to receive notifications on (you can also leave the email field empty and setup other integrations, see below).
8. _(Optional, but recommended)_ Set a lower timeout for the scheduled actor – this actor's run should never take a long time, so you can set a lower run-time limit, for example 90 seconds.
9. Save the actor configuration changes.
10. Go back to the _Settings_ tab and save the new configuration.

[actor-in-console]: https://console.apify.com/actors/pvyhTWhRoFCRgWKGE

### Actor output

If you want to create your custom integration, you need to know about the output format it provides.

Note that not every run produces some results, so you need to check that.

#### Dataset

Each actor run has a default dataset assigned by the Apify Console. This actor puts into the dataset an entry for each new mention found. So each row looks something like this:

```json
{
  "created_at": "2022-06-08T19:00:00.000Z",
  "created_at_i": 1654714800,
  "title": null,
  "url": null,
  "author": "johndoe",
  "points": null,
  "story_text": null,
  "comment_text": "This is an example.<p>It&#x27;s a very simple subset of HTML, as is typical to HN. This is what a link looks like <a href=\"https:&#x2F;&#x2F;example.com&#x2F;\" rel=\"nofollow\">https:&#x2F;&#x2F;example.com&#x2F;</a>",
  "num_comments": null,
  "story_id": 123456,
  "story_title": "Some post name",
  "story_url": "https://example.com/",
  "parent_id": 123456,
  "_tags": ["comment", "author_johndoe", "story_123456"],
  "objectID": 1234567
}
```

The available (non-null) properties differ by item type (which you have to infer) - keyword matches in comments have `comment_text`, `story_title` and `story_url`, top-level posts always have a `title`. Availability of `url` and `story_text` differs - some stories have it, some not.

#### `OUTPUT` in default Key-value store

For your convenience, this actor also provides `OUTPUT` (in `text/plain`, very simple markdown format) in the default key-value store, which contains a user-readable summary of each match, including a link to Hacker News and relevant fields. This is the format that is sent by email if you provide one in actor input.

Example:

```raw
**New mentions of 'keyword' on Hacker news**


Comment by jane_doe on post 'Some post name' (https://example.com/):
  This is an example

  It's a very simple subset of HTML, as is typical to HN. This is what a link looks like https://example.com/
HN link: https://news.ycombinator.com/item?id=1234567

Post 'Some post name' posted by johndoe (https://example.com/)
HN link: https://news.ycombinator.com/item?id=123456
```

This value is missing when there's no new items found.

#### `hacker-news-search-alert` named Key-value store

The actor uses this named, persistent key-value store to save identifier of the last seen item for each query. **If you remove a value from this store or start the scraper for the first time on a given keyword, the actor will return the last 20 items.**

### Custom integrations

If email notifications are unsuitable for your use-case, you can use Apify integrations to run a webhook after each run.

There are two options:

#### Add directly to actor

This sets the integration for your actor globally, for all runs. This means if you'll want to setup multiple different monitors, each of them will trigger this same webhook.

To setup:

1. Open the _Actors_ page in Apify Console.
2. Find this actor (`mvolfik/hacker-news-keyword-alert` – [Direct link][actor-in-console]).
3. Switch to the _Integrations_ tab.
4. Click _Add new webhook_.
5. Setup your webhook. The most useful variable to you is `resource`: for _Run succeeded_ events, this contains data about the actor output dataset and key-value stores. See below for details about this Actor's output.
6. Don't forget to save the integration.

#### Create a new task & add the integration there

1. Open the _Actors_ page in Apify Console.
2. Find this actor (`mvolfik/hacker-news-keyword-alert` – [Direct link][actor-in-console]).
3. In the top right, click _Create empty task_.
4. Configure the task input the same way as you configured the actor in the schedule and click _Save_.
5. Go to the _Settings_ and rename the task so you can easily identify it - you'll probably want to mention the keyword in the name (don't forget to click _Save_ again).
6. Open the _Integrations_ tab and follow steps 4-6 above as if you were adding the integration to the actor.
7. Now go the the _Schedules_ page in Apify Console and open the schedule you created earlier, or create a new one.
8. In the _Actors and Tasks_ tab, click _Add new_, and add a _Task_.
9. Now select the task you created earlier. In the _Input JSON overrides_ field, leave the default value `{}` (this means an empty object, i.e. no overrides).
10. Save the task.
