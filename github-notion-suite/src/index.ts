import { Client } from "@notionhq/client"
import { RequestParameters } from "@notionhq/client/build/src/Client"
import { Octokit } from "octokit"
import { config } from "dotenv"

config()

const octokit = new Octokit({ auth: process.env.GITHUB_KEY })
const notion = new Client({ auth: process.env.NOTION_KEY })

const db_id = process.env.NOTION_DATABASE_ID

async function sync_issues() {
    console.log("Syncing GitHub Issues with Notion Database")

    const issues_in_db = await get_issues_from_db()

    const github_issues = {}

    const iterator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
        owner: process.env.GITHUB_REPO_OWNER,
        repo: process.env.GITHUB_REPO_NAME,
        per_page: 100,
    })

    for await (const { data: issues } of iterator) {
        for (const issue of issues) {
            const { id, title, state, comments, number } = issue
            github_issues[number] = { id, title, state, comments, number }
        }
    }
}

async function get_issues_from_db() {
    const issues = {}

    async function get_page_of_issues(cursor?: number | string) {
        const req_payload: RequestParameters = {
            path: "databases/" + db_id + "/query",
            method: "post",
        }

        if (cursor) {
            req_payload.body = {
                start_cursor: cursor,
            }
        }

        const current_pages = await notion.request(req_payload)

        for (const page of current_pages.results) {
            issues[page.properties["Issue Number"].number] = {
                page_id: page.id,
            }
        }
        if (current_pages.has_more) {
            await get_page_of_issues(current_pages.next_cursor)
        }
    }

    await get_page_of_issues()
    return issues
}

sync_issues()
