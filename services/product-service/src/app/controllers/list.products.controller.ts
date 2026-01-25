import { RequestContext } from "../../handler/api-gateway/types";
import { ListProductsUseCase } from "../usecases/list.product.usecase";

export class ListProductsController {
  constructor(
    private readonly useCase: ListProductsUseCase
  ) {}

  handle = async (req: RequestContext) => {
    const pageNumber = Number(req.query.page_number ?? 1);
    const pageSize = Number(req.query.page_size ?? 20);
    
    const result = await this.useCase.execute({
      pageNumber,
      pageSize,
      type: req.query.type as any,
      isActive: req.query.active
        ? req.query.active === "true"
        : undefined
    });

    // Transform to new response format
    const total = result.total >= 0 ? result.total : 0;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      amount: total,
      data: result.items,
      pagination: {
        page_size: pageSize,
        page_number: pageNumber,
        total_pages: totalPages
      }
    };
  };
}
