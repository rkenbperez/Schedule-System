# Changelog

All notable project changes will be documented in this file.

## [0.1.0.0] - 2026-09-10

### Added
- Pagination support for API endpoints (rooms, professors, departments, rooms listing)
- Hard constraint validation for consecutive hours teaching limit (3-hour maximum)
- Soft score breakdown fields (spread, consecutive, preferred) in schedule run serialization
- 5 new edge case tests for consecutive-hours constraint and pagination

### Changed
- Updated API response format to use DRF pagination
- Modified test expectations to reflect correct constraint behavior
- Enhanced serializer with spread, consecutive, and preferred soft score methods
- Added .gstack/ to .gitignore

### Fixed
- Fixed _consecutive_hours_violation NameError (scenario parameter, meeting_map lookup)
- Fixed serializer AttributeError on breakdown field via getattr guard
- Fixed pagination test assertions to use response.data["results"]

### Added
- Pagination configuration (DEFAULT_PAGINATION_CLASS, PAGE_SIZE) in core settings