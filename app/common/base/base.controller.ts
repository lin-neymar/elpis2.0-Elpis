export class BaseController {
  /*
   * API 处理成功时统一返回结构
   */
  protected success(data: unknown = {}, metadata: Record<string, unknown> = {}) {
    return {
      success: true,
      data,
      metadata,
    };
  }

  /*
   * API 处理失败时统一返回结构
   */
  protected fail(message: string, code: number) {
    return {
      success: false,
      message,
      code,
    };
  }
}
