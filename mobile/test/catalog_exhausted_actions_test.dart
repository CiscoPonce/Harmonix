import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:harmonix_mobile/widgets/catalog_exhausted_actions.dart';

void main() {
  testWidgets('shows change-style and search when the catalog is exhausted', (tester) async {
    var styleTaps = 0;
    var searchTaps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CatalogExhaustedActions(
            changeStyleLabel: 'Change music style',
            searchLabel: 'Search a song',
            onChangeStyle: () => styleTaps += 1,
            onSearch: () => searchTaps += 1,
          ),
        ),
      ),
    );
    expect(find.text('Change music style'), findsOneWidget);
    expect(find.text('Search a song'), findsOneWidget);
    await tester.tap(find.text('Change music style'));
    await tester.tap(find.text('Search a song'));
    expect(styleTaps, 1);
    expect(searchTaps, 1);
  });
}
