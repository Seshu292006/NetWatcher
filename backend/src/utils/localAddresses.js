import os from 'os';

export async function getLocalAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = new Set();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.address) {
        addresses.add(entry.address);
      }
    }
  }

  return addresses;
}

export function classifyDirection(sourceIp, destinationIp, localAddresses) {
  const sourceLocal = localAddresses.has(sourceIp);
  const destinationLocal = localAddresses.has(destinationIp);

  if (sourceLocal && !destinationLocal) return 'outbound';
  if (!sourceLocal && destinationLocal) return 'inbound';
  if (sourceLocal && destinationLocal) return 'local';
  return 'unknown';
}
