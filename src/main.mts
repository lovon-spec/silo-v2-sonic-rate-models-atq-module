import type { ContractTag, ITagService } from "atq-types";

const DEPLOYMENT = "QmQUcPAEpUQJL3AYK21hsgNnj6XmWepTXJXySHdFXMmp7p";
const ENDPOINT = `https://gateway.thegraph.com/api/deployments/id/${DEPLOYMENT}`;
const PAGE_SIZE = 1000;
const MAX_PAGES = 1000;
type Meta = { deployment: string; hasIndexingErrors: boolean; block: { number: number; hash: string } };
type RateConfig = { id: string; config: string; modelVersion: number };
function address(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-f]{40}$/.test(value) && !/^0x0{40}$/.test(value);
}
function checkedMeta(meta: Meta): Meta {
  if (meta?.deployment !== DEPLOYMENT || meta.hasIndexingErrors !== false ||
      !Number.isSafeInteger(meta.block?.number) || meta.block.number < 1 ||
      !/^0x[0-9a-f]{64}$/.test(meta.block?.hash ?? "")) throw new Error("Incomplete or unhealthy Silo source.");
  return meta;
}
function sameMeta(meta: Meta, anchor: Meta): void {
  checkedMeta(meta);
  if (meta.block.number !== anchor.block.number || meta.block.hash !== anchor.block.hash) {
    throw new Error("The Silo source snapshot changed.");
  }
}
function toTag(config: RateConfig): ContractTag {
  if (!/^0x[0-9a-f]{64}$/.test(config.id) || !address(config.config) || config.modelVersion !== 2) {
    throw new Error("Invalid Silo V2 interest-rate configuration identity.");
  }
  const fullName = "Silo V2 IRM " + config.id;
  const name = [...fullName].length > 50 ? [...fullName].slice(0, 47).join("") + "..." : fullName;
  return {
    "Contract Address": `eip155:146:${config.config}`,
    "Public Name Tag": name,
    "Project Name": "Silo Finance",
    "UI/Website Link": "https://app.silo.finance/",
    "Public Note": "Silo Finance V2 interest-rate-model contract used by lending vaults to calculate utilization-dependent interest rates. " +
      `Model version: ${config.modelVersion}. Configuration identifier: ${config.id}.`,
  };
}
const service: ITagService = {
  returnTags: async (chainId: string, apiKey: string): Promise<ContractTag[]> => {
    if (chainId !== "146") throw new Error(`Unsupported Chain ID: ${chainId}.`);
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) throw new Error("A supplied query-service key is required.");
    let requests = 0;
    async function query<T>(request: { query: string; variables?: object }): Promise<T> {
      if (++requests > MAX_PAGES + 2) throw new Error("Silo query limit reached.");
      if (requests > 1) await new Promise<void>(resolve => setTimeout(resolve, 2000));
      const response = await fetch(ENDPOINT, { method: "POST", redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(request) });
      if (!response.ok) throw new Error(`Silo query failed with HTTP ${response.status}.`);
      const result = await response.json() as { data?: T; errors?: unknown };
      if (!result.data || result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length > 0)) {
        throw new Error("The Silo query did not return complete data.");
      }
      return result.data;
    }
    const anchor = checkedMeta((await query<{ _meta: Meta }>({
      query: "{_meta{deployment hasIndexingErrors block{number hash}}}" }))._meta);
    const block = { hash: anchor.block.hash }, tags: ContractTag[] = [];
    let cursor: string | null = null, complete = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const continued = cursor !== null;
      const data: { interestRateModelConfigs: RateConfig[]; _meta: Meta } = await query({
        query: "query Controllers(" + (continued ? "$cursor:Bytes!," : "") + "$block:Block_height!){" +
          "interestRateModelConfigs(first:1000,orderBy:id,orderDirection:asc," +
          (continued ? "where:{id_gt:$cursor}," : "") + "block:$block){id config modelVersion}" +
          " _meta(block:$block){deployment hasIndexingErrors block{number hash}}}",
        variables: { ...(continued ? { cursor } : {}), block },
      });
      sameMeta(data._meta, anchor);
      if (!Array.isArray(data.interestRateModelConfigs) || data.interestRateModelConfigs.length > PAGE_SIZE) {
        throw new Error("Invalid Silo rate-model page.");
      }
      for (const config of data.interestRateModelConfigs) {
        if (!/^0x[0-9a-f]{64}$/.test(config?.id ?? "") || cursor !== null && config.id <= cursor) {
          throw new Error("Repeated or unordered Silo rate-model ID.");
        }
        const tag = toTag(config);
        if (tags.some(existing => existing["Contract Address"] === tag["Contract Address"])) {
          throw new Error("Repeated Silo rate-model contract.");
        }
        tags.push(tag); cursor = config.id;
      }
      if (data.interestRateModelConfigs.length < PAGE_SIZE) { complete = true; break; }
    }
    if (!complete) throw new Error("Silo rate-model pagination did not finish.");
    sameMeta((await query<{ _meta: Meta }>({
      query: "query Seal($block:Block_height!){_meta(block:$block){deployment hasIndexingErrors block{number hash}}}",
      variables: { block } }))._meta, anchor);
    const names = new Map<string, number>();
    for (const tag of tags) { const n = tag["Public Name Tag"].toLowerCase(); names.set(n, (names.get(n) ?? 0) + 1); }
    for (const tag of tags) {
      if (names.get(tag["Public Name Tag"].toLowerCase()) !== 1) {
        tag["Public Name Tag"] = "Silo " + tag["Contract Address"].split(":")[2];
      }
    }
    return tags;
  },
};
export async function returnTags(chainId: string, apiKey: string): Promise<ContractTag[]> {
  return service.returnTags(chainId, apiKey);
}
