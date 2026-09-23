import 'package:flutter/material.dart';

/// Actions shown when Next cannot find an unused song.
class CatalogExhaustedActions extends StatelessWidget {
  const CatalogExhaustedActions({
    super.key,
    required this.changeStyleLabel,
    required this.searchLabel,
    required this.onChangeStyle,
    required this.onSearch,
  });

  final String changeStyleLabel;
  final String searchLabel;
  final VoidCallback onChangeStyle;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        OutlinedButton(onPressed: onChangeStyle, child: Text(changeStyleLabel)),
        OutlinedButton(onPressed: onSearch, child: Text(searchLabel)),
      ],
    );
  }
}
