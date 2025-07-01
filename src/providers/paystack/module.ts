import { ModuleProviderExports } from "@medusajs/framework/types"
import { PaystackProvider } from "./index"

const services = [PaystackProvider]

const providerExport: ModuleProviderExports = {
  services,
}

export default providerExport
