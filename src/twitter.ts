import Twitter, { RequestParameters } from "twitter-v2";
import { Client } from "twitter.js";
import { twitter_inference } from "./ai";
import { Database } from "bun:sqlite";

export const db = new Database("db.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec(
  "CREATE TABLE IF NOT EXISTS tweets (id TEXT PRIMARY KEY, tweet_content TEXT, has_replied_to BOOL);"
);

class Tweet {
  id!: string;
  tweet_content!: string;
  has_replied_to!: boolean;
}

interface TweetReplies {
  id: string;
  text: string;
  conversation_id: string;
  edit_history_tweet_ids: string[];
}

const fetch_twitter_client = new Twitter({
  consumer_key: process.env.API_KEY!,
  consumer_secret: process.env.API_KEY_SECRET!,
  access_token_key: process.env.ACCESS_TOKEN!,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET!,
});
const post_twitter_client = new Client();
await post_twitter_client.login({
  bearerToken: process.env.BEARER_TOKEN!,
  accessToken: process.env.ACCESS_TOKEN!,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
  consumerKey: process.env.API_KEY!,
  consumerSecret: process.env.API_KEY_SECRET!,
});

function db_get_tweets(): Tweet[] {
  let tweets = db
    .query("SELECT * FROM tweets WHERE has_replied_to = false;")
    .as(Tweet)
    .all();

  return tweets;
}

async function get_replies(conversation_id: string): Promise<TweetReplies[]> {
  let response: Object | undefined = await fetch_twitter_client.get(
    "tweets/search/recent",
    {
      query: `conversation_id:${conversation_id}`,
    }
  );

  // @ts-ignore
  let replies: TweetReplies[] = response["data"];

  return replies;
}

function get_tweet_by_id(
  id: string,
  get_conversation_id: boolean = false
): Promise<Object | undefined> {
  let to_search: RequestParameters = {
    ids: id,
  };

  if (get_conversation_id) {
    to_search = {
      ids: id,
      "tweet.fields": "conversation_id",
    };
  }

  return fetch_twitter_client.get("tweets", to_search);
}

async function create_tweet(text: string, inReplyToTweet?: string) {
  try {
    if (inReplyToTweet) {
      await post_twitter_client.tweets.create({
        text,
        inReplyToTweet,
      });

      db.exec("UPDATE tweets SET has_replied_to = true WHERE id = ?1;", [
        inReplyToTweet,
      ]);
    } else {
      let result = await post_twitter_client.tweets.create({
        text,
      });

      db.exec(
        "INSERT INTO tweets(id, tweet_content, has_replied_to) VALUES (?1, ?2, false);",
        [result.id, text]
      );
    }
  } catch (error) {
    console.error("Error when trying to tweet: ", error);
  }
}

async function new_tweet() {
  let response = await twitter_inference(
    "Write a tweet about crypto or ALICE token (which is an upcoming token about\
     AI automation in Solana blockchain). Write about only one of them. do NOT say Yo every time.",
    0.85
  );

  await create_tweet(response);
}

async function find_and_respond_to_replies() {
  let tweet = db_get_tweets().reverse().pop();
  if (tweet) {
    try {
      let replies = await get_replies(tweet.id);

      replies.forEach(async (reply) => {
        let response = await twitter_inference(
          `original tweet: ${tweet.tweet_content}\nrespond to a reply such as this: \n${reply.text}`
        );

        await create_tweet(response, reply.id);
      });
    } catch (e) {
      console.error("Error trying to reply to tweet replies: " + e);

      db.exec("UPDATE tweets SET has_replied_to = true WHERE id = ?1;", [
        tweet.id,
      ]);
    }
  }
}

export async function twitter() {
  await find_and_respond_to_replies();
  await new_tweet();
}
