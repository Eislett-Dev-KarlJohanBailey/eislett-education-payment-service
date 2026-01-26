import { RequestContext } from "../../handler/api-gateway/types";
import { ListPricesByProductUseCase } from "@libs/domain/src/pricing/app/usecases/list.prices.by.product.usecase";
import { PriceResponseMapper } from "@libs/domain/src/pricing/app/mappers/price.mapper";

export class ListPricesByProductController {
  constructor(
    private readonly useCase: ListPricesByProductUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const productId = req.pathParams.productId;
    const pageNumber = Number(req.query.page_number ?? 1);
    const pageSize = Number(req.query.page_size ?? 20);
    
    const result = await this.useCase.execute({
      productId,
      pageNumber,
      pageSize
    });

    // Transform to new response format
    const total = result.total >= 0 ? result.total : 0;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      amount: total,
      data: PriceResponseMapper.toDtoList(result.items),
      pagination: {
        page_size: pageSize,
        page_number: pageNumber,
        total_pages: totalPages
      }
    };
  };
}
