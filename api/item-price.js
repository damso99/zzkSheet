import { handleItemPriceRequest } from "./_item-price.js";

export default async function handler(request, response) {
  await handleItemPriceRequest(request, response);
}
