import { camelCase, chain, isArray, kebabCase } from 'lodash'
import { json } from 'itty-router'

// @ts-expect-error module export types malformed
import { notionToJson } from 'notion-json-lens'

import {
  Client,
  collectPaginatedAPI,
  isFullPage,
  isNotionClientError,
} from '@notionhq/client'
import { GetPagePropertyResponse } from '@notionhq/client/build/src/api-endpoints'

export async function getStreamerIndex(
  url: string,
  { INDEX_DB, TTL, NOTION_API_KEY }: Env,
) {
  const notion = new Client({ auth: NOTION_API_KEY })

  const origPages = await collectPaginatedAPI(notion.databases.query, {
    database_id: INDEX_DB,
  })

  const pages = origPages
    .filter(isFullPage)
    .map(({ properties, ...rest }) => ({
      props: chain(notionToJson(properties) as Record<string, any>)
        .mapKeys((_v, k) =>
          k === 'CashApp' || k === 'PayPal' ? k.toLowerCase() : camelCase(k),
        )
        .omitBy((v) => v == null || v === '' || (isArray(v) && v.length === 0))
        .value(),
      ...rest,
    }))
    .filter(({ props }) => props.name && props.publish)

  for (const { id, props } of pages) {
    props.slug = kebabCase((props.slug ?? props.name).toLowerCase())

    const photoURL = props.photo?.[0]?.file.url
    if (photoURL) {
      const { origin } = new URL(url)
      const { pathname: photoPath } = new URL(photoURL)
      props.photo = `${origin}/streamers/${id}${photoPath}`
    } else {
      props.photo = null
    }
  }

  return json(
    pages.map(({ props }) => props),
    {
      headers: {
        'Cache-Control': `max-age=${TTL}`,
      },
    },
  )
}

export async function getStreamerPhoto(
  pageId: string,
  { NOTION_API_KEY }: Env,
) {
  const notion = new Client({ auth: NOTION_API_KEY })

  let photo: GetPagePropertyResponse
  try {
    photo = await notion.pages.properties.retrieve({
      page_id: pageId,
      property_id: 'Photo',
    })
  } catch (err) {
    if (isNotionClientError(err) && err.code === 'object_not_found') {
      return null
    }
    throw err
  }

  if (
    photo.type !== 'files' ||
    !photo.files.length ||
    photo.files[0].type !== 'file'
  ) {
    return null
  }

  return photo.files[0].file.url
}
