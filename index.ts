import { AutoRouter, IRequest, cors, error } from 'itty-router'
import { getStreamerIndex, getStreamerPhoto } from './notion'

const { preflight, corsify } = cors()

const router = AutoRouter<IRequest, [Env]>({
  before: [preflight],
  catch: (err) => {
    console.error(err)
    return error(500)
  },
})

router.get('/streamers/index.json', async ({ url }, env) => {
  const response = await getStreamerIndex(url, env)
  return corsify(response)
})

router.get(
  '/streamers/:pageId/:imgName',
  async ({ params: { pageId } }, env) => {
    const imgURL = await getStreamerPhoto(pageId, env)
    if (!imgURL) {
      return error(404)
    }
    const resp = await fetch(imgURL)
    return resp
  },
)

export default { ...router }
