/// Keyset-pagination page, mirroring the server's `{ items, nextCursor }`
/// (api/src/lib/pagination.ts). The API never uses OFFSET, so screens page by
/// passing `nextCursor` back as `?cursor=`.
class Page<T> {
  Page(this.items, this.nextCursor);

  final List<T> items;
  final String? nextCursor;

  factory Page.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromItem,
  ) {
    final list = (json['items'] as List<dynamic>? ?? const [])
        .map((e) => fromItem(e as Map<String, dynamic>))
        .toList();
    return Page(list, json['nextCursor'] as String?);
  }
}
