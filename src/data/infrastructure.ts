export const NODE_IDS = ['monster', 'phoenix', 'wraith'] as const;
export type NodeId = (typeof NODE_IDS)[number];

export const FLOW_IDS = ['overview', 'public', 'private', 'observability'] as const;
export type FlowId = (typeof FLOW_IDS)[number];

export interface InfrastructureService {
  readonly name: string;
  readonly description: string;
}

export interface InfrastructureNode {
  readonly id: NodeId;
  readonly name: string;
  readonly role: string;
  readonly architecture: 'ARM64' | 'x86';
  readonly compute: string;
  readonly description: string;
  readonly networking: string;
  readonly operations: string;
  readonly services: readonly InfrastructureService[];
}

export interface InfrastructureFlow {
  readonly id: FlowId;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly string[];
  readonly directional: boolean;
}

// Public content is intentionally independent of operational configuration.
// Source: references/infrastructure.html; these roles are not live observations.
export const infrastructureNodes: readonly InfrastructureNode[] = [
  {
    id: 'monster',
    name: 'Monster',
    role: 'Core application & observability',
    architecture: 'ARM64',
    compute: 'OCI A1.Flex · 4 OCPU · 12 GB RAM',
    description:
      'The application core brings together containerized workloads, centralized log tooling and the observability stack.',
    networking:
      'Administrative dashboards use private mesh access, with reverse proxy management on the core node.',
    operations:
      'Heavier application workloads, central monitoring, log viewing and backup tooling are grouped on the ARM64 node.',
    services: [
      { name: 'Docker', description: 'Runs containerized applications and supporting services.' },
      {
        name: 'Portainer',
        description:
          'Provides a container management interface, with administrative access kept on the private mesh.',
      },
      { name: 'Prometheus', description: 'Collects metrics for the observability stack.' },
      {
        name: 'Grafana',
        description:
          'Presents monitoring information through a privately accessed administrative dashboard.',
      },
      {
        name: 'Nginx Proxy Manager',
        description: 'Provides reverse proxy management on the core node.',
      },
      { name: 'Uptime Kuma', description: 'Provides service availability checks.' },
      { name: 'Homepage', description: 'Provides a central landing page for services.' },
      {
        name: 'WireGuard (wg-easy)',
        description:
          'Provides tooling for WireGuard remote access. Peer configuration and keys remain private.',
      },
      {
        name: 'Stirling-PDF',
        description: 'Provides self-hosted PDF utilities as an application workload.',
      },
      {
        name: 'OpenSpeedTest',
        description: 'Provides a self-hosted network speed testing application.',
      },
      { name: 'Digital-ID', description: 'An application workload on the core node.' },
      { name: 'Watchtower', description: 'Provides container image update tooling.' },
      {
        name: 'Dozzle',
        description: 'Provides container log viewing alongside the central operations tools.',
      },
      {
        name: 'Restic',
        description: 'Provides backup tooling; destinations and credentials remain private.',
      },
      {
        name: 'CrowdSec',
        description: 'Provides security tooling alongside the monitoring and administration stack.',
      },
    ],
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    role: 'Public ingress & edge services',
    architecture: 'x86',
    compute: 'OCI E2.Micro · 1/8 OCPU · 1 GB RAM',
    description:
      'A dedicated ingress role receives public web traffic through a Cloudflare Tunnel connector.',
    networking: 'Cloudflared handles tunnel-based ingress, with Nginx serving the edge role.',
    operations:
      'Ingress and supporting agents run within a fractional micro-instance resource budget.',
    services: [
      {
        name: 'Cloudflared',
        description: 'Runs the tunnel connector used for public ingress on Phoenix.',
      },
      { name: 'Nginx (Alpine)', description: 'Provides an Nginx service on the ingress node.' },
      {
        name: 'Portainer Agent',
        description: 'Supports remote container management from the central administration tools.',
      },
      {
        name: 'Node Exporter',
        description: 'Exposes host metrics for collection by the monitoring stack.',
      },
      {
        name: 'Dozzle Agent',
        description: 'Supports container log viewing from the central log tooling.',
      },
      { name: 'Watchtower', description: 'Provides container image update tooling.' },
      { name: 'iperf3', description: 'Provides a network throughput testing tool.' },
      {
        name: 'Restic',
        description: 'Provides backup tooling; destinations and credentials remain private.',
      },
    ],
  },
  {
    id: 'wraith',
    name: 'Wraith',
    role: 'Asynchronous edge workloads',
    architecture: 'x86',
    compute: 'OCI E2.Micro · 1/8 OCPU · 1 GB RAM',
    description: 'A stateless edge role handles asynchronous jobs and on-demand proxy workloads.',
    networking:
      'The edge toolkit includes a tunnel connector, proxy workloads and host networking for the telemetry investigation.',
    operations:
      'Fractional compute makes continuous telemetry overhead worth investigating. Reported context-switch changes do not prove a reduction in CPU steal time.',
    services: [
      { name: 'Telegram Proxy', description: 'An on-demand proxy workload on the edge node.' },
      { name: 'WhatsApp Proxy', description: 'An on-demand proxy workload on the edge node.' },
      { name: 'Cloudflared', description: 'Provides a tunnel connector on the edge node.' },
      {
        name: 'Host Networking',
        description:
          'A container networking mode used in the telemetry investigation. It changes networking isolation and is not a bypass for hypervisor scheduling.',
      },
      {
        name: 'Portainer Agent',
        description: 'Supports remote container management through private administration access.',
      },
      {
        name: 'Node Exporter',
        description: 'Provides host metrics for collection by the monitoring stack.',
      },
      {
        name: 'Dozzle Agent',
        description: 'Supports container log viewing from the central log tooling.',
      },
      { name: 'Watchtower', description: 'Provides container image update tooling.' },
      { name: 'iperf3', description: 'Provides network throughput testing.' },
      {
        name: 'Restic',
        description: 'Provides backup tooling; destinations and credentials remain private.',
      },
    ],
  },
];

export const infrastructureFlows: readonly InfrastructureFlow[] = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'Distinct compute responsibilities',
    description:
      'The environment separates core applications, public ingress and asynchronous edge workloads into distinct compute responsibilities.',
    steps: [
      'Monster / core & observability',
      'Phoenix / public ingress',
      'Wraith / asynchronous workloads',
    ],
    directional: false,
  },
  {
    id: 'public',
    label: 'Public ingress',
    title: 'Public request path',
    description:
      'Public web traffic enters through the Cloudflare edge and the tunnel connector on Phoenix. The application destination is conceptual; exact reverse proxy mappings are unspecified.',
    steps: [
      'Visitor',
      'Cloudflare edge',
      'Phoenix / tunnel connector',
      'Application service / mapping unspecified',
    ],
    directional: true,
  },
  {
    id: 'private',
    label: 'Private administration',
    title: 'Administrative access boundary',
    description:
      'An authorized device reaches Grafana and Portainer through the private Tailscale mesh. Private DNS alone does not establish authorization.',
    steps: [
      'Authorized device',
      'Tailscale private mesh',
      'Administrative service / Grafana or Portainer',
    ],
    directional: true,
  },
  {
    id: 'observability',
    label: 'Observability',
    title: 'Metrics collection relationship',
    description:
      'Edge-node exporters support the Prometheus and Grafana stack on Monster. This conceptual collection path shows the private mesh relationship; exact scrape targets are unspecified.',
    steps: [
      'Edge-node exporters / targets unspecified',
      'Private mesh / collection relationship',
      'Monster / Prometheus & Grafana',
    ],
    directional: true,
  },
];

export function getInfrastructureNode(id: string): InfrastructureNode | undefined {
  return infrastructureNodes.find((node) => node.id === id);
}

export function getInfrastructureFlow(id: string): InfrastructureFlow | undefined {
  return infrastructureFlows.find((flow) => flow.id === id);
}
