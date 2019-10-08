# Verda

Verda is a tracing promise runner that allows dynamic dependencies.

## Usage

```bash
npm install verda
```

After that, prepare a `verdafile.js` under your repository, providing build recipes:

```js
const build = require('verda').createBuildAndThenStart();

build.setJournal(`build/.verda-journal`);

const { oracle, file } = build.ruleTypes;

const one = oracle("one", async t => 1);
const two = oracle("two", async t => {
    const [one] = await t.need(one);
    return one + 1;
});
```

## Strongly-typed rules

In Verda, all rules are strongly typed:

```typescript
const build = require('verda').createBuildAndThenStart();
const { computed, file } = build.ruleTypes;
const { fu } = build.rules;
const { run, node, cd, cp, rm } = build.actions;

const ObjFile = file.glob('build/*.o', async (t, o) => {
    const c = await t.need(fu`src/${o.name}.c`);
    await run('gcc', c.full, '-o', o.full);
});
```

