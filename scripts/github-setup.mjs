// 仅供仓库维护者在本机运行；从 Git Credential Manager 读取授权，不打印或持久化凭证。
import { spawnSync } from 'node:child_process';
const repo = 'shunshun-968/nju-xianlin-food-map';
const result = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
});
const token = result.stdout
  ?.split('\n')
  .find((line) => line.startsWith('password='))
  ?.slice(9);
if (!token) throw new Error('请先通过 Git Credential Manager 登录 GitHub。');
async function api(path, method = 'GET', body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? {} : await res.json();
  if (!res.ok) return { error: res.status, message: data.message };
  return data;
}
const command = process.argv[2] || 'inspect';
if (command === 'inspect') {
  const [user, repository, pages] = await Promise.all([
    api('/user'),
    api(`/repos/${repo}`),
    api(`/repos/${repo}/pages`),
  ]);
  console.log(
    JSON.stringify(
      {
        user: { login: user.login, id: user.id, plan: user.plan?.name, error: user.error },
        repository: {
          private: repository.private,
          defaultBranch: repository.default_branch,
          permissions: repository.permissions,
          error: repository.error,
        },
        pages: {
          url: pages.html_url,
          status: pages.status,
          buildType: pages.build_type,
          error: pages.error,
          message: pages.message,
        },
      },
      null,
      2,
    ),
  );
} else if (command === 'public-if-free') {
  const user = await api('/user');
  const repository = await api(`/repos/${repo}`);
  const eligibility = repository.private
    ? await api(`/repos/${repo}/pages`, 'POST', { build_type: 'workflow' })
    : {};
  const unsupported =
    eligibility.error === 422 &&
    eligibility.message === 'Your current plan does not support GitHub Pages for this repository.';
  if (
    user.login !== 'shunshun-968' ||
    (!unsupported && user.plan?.name !== 'free') ||
    !repository.permissions?.admin
  )
    throw new Error('无法核实方案限制与管理员权限；未更改仓库可见性。');
  if (repository.private) {
    const changed = await api(`/repos/${repo}`, 'PATCH', { private: false });
    console.log(
      JSON.stringify({ private: changed.private, error: changed.error, message: changed.message }),
    );
  } else console.log('仓库已经公开。');
} else if (command === 'pages') {
  const old = await api(`/repos/${repo}/pages`);
  const response = await api(`/repos/${repo}/pages`, old.error === 404 ? 'POST' : 'PUT', {
    build_type: 'workflow',
  });
  console.log(
    JSON.stringify({ url: response.html_url, error: response.error, message: response.message }),
  );
} else if (command === 'runs') {
  const response = await api(`/repos/${repo}/actions/runs?per_page=3`);
  console.log(
    JSON.stringify(
      response.workflow_runs?.map((run) => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        url: run.html_url,
      })) || response,
    ),
  );
} else throw new Error('Unknown command');
