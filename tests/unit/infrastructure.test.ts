import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FLOW_IDS,
  NODE_IDS,
  getInfrastructureFlow,
  getInfrastructureNode,
  infrastructureFlows,
  infrastructureNodes,
} from '../../src/data/infrastructure';

describe('public architecture content', () => {
  it('preserves every documented service on its documented node', () => {
    const cards = JSON.parse(
      readFileSync(new URL('../fixtures/infrastructure-services.json', import.meta.url), 'utf8'),
    ) as { name: string; services: string[] }[];
    expect(cards).toHaveLength(NODE_IDS.length);
    cards.forEach(({ name, services: tags }) => {
      const node = infrastructureNodes.find((entry) => entry.name === name);
      expect(node, `Missing documented node ${name}`).toBeDefined();
      expect(node?.services.map((service) => service.name)).toEqual(tags);
    });
  });

  it('does not ship operational endpoints or credential-shaped values in the public model', () => {
    const publicContent = JSON.stringify({ infrastructureNodes, infrastructureFlows });
    expect(publicContent).not.toMatch(
      /https?:\/\/|\b(?:\d{1,3}\.){3}\d{1,3}\b|-----BEGIN|(?:api[_-]?key|password|token|secret)\s*[:=]/i,
    );
    expect(publicContent).not.toMatch(/100\.[x\d]/i);
  });

  it('resolves known nodes and paths but rejects unsupported identifiers', () => {
    NODE_IDS.forEach((id) => expect(getInfrastructureNode(id)?.id).toBe(id));
    FLOW_IDS.forEach((id) => expect(getInfrastructureFlow(id)?.id).toBe(id));
    expect(getInfrastructureNode('__proto__')).toBeUndefined();
    expect(getInfrastructureNode('unknown')).toBeUndefined();
    expect(getInfrastructureFlow('live')).toBeUndefined();
  });

  it('keeps incomplete route mappings explicit and separates responsibilities from traffic', () => {
    expect(getInfrastructureFlow('overview')?.directional).toBe(false);
    expect(getInfrastructureFlow('public')?.steps.at(-1)).toMatch(/unspecified/);
    expect(getInfrastructureFlow('observability')?.description).toMatch(/conceptual/);
    expect(getInfrastructureFlow('private')?.description).toMatch(
      /DNS alone does not establish authorization/,
    );
    expect(
      infrastructureNodes
        .flatMap((node) => node.services)
        .every((service) => service.description.length > 0),
    ).toBe(true);
  });
});
