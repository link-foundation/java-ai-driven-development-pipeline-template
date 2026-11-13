_This page provides guidance on upgrading from JUnit 5.x to 6.0_

## Overview

Migrating from JUnit 5.x.y to 6.0.0 should be much easier than migrating from 4.x to 5.x.
Only APIs that have been deprecated for over two years have been removed.
All other APIs continue to be supported, making version 6.0.0 a drop-in replacement in most cases.

## New Baselines

JUnit 6.0.0 increases the following baselines:

- Java 17 (was 8)
- Kotlin 2.1 (was 1.6)

Therefore, if your project uses earlier versions of Java and/or Kotlin, you should first switch to Java 17 or later and/or Kotlin 2.1 or later.

## New Versioning Scheme

To simplify dependency management, all modules of JUnit Platform, Jupiter, and Vintage now use the same version number: `6.0.0`.
See the [User Guide](https://docs.junit.org/6.0.0/user-guide/#dependency-metadata) for a list of all artifacts.

## Removed Modules

- `junit-platform-jfr` (now included in `junit-platform-launcher`, see [User Guide](https://docs.junit.org/6.0.0/user-guide/#running-tests-listeners-flight-recorder))
- `junit-platform-runner` (without replacement)
- `junit-platform-suite-commons` (now integrated into `junit-platform-suite`)

## Removed APIs

Please refer to the [release notes](https://docs.junit.org/6.0.0/release-notes) for a list of all removed APIs.

## Null Safety

Starting with version 6.0.0, JUnit has adopted [JSpecify](https://jspecify.dev/).
Its annotations are used to mark which of the types used in the API are nullable.
JSpecify is supported in IDEs such as IntelliJ IDEA so you may notice new warnings when programming against JUnit's APIs.
To check nullability during your build, we recommend using [Error Prone](https://errorprone.info/) and [NullAway](https://github.com/uber/NullAway).

## Deprecated APIs

### JUnit Jupiter

#### Execution Conditions

Due to the baseline change from Java 8 to 17, some usages of Jupiter's JRE-related conditional execution annotations (`@EnabledOnJre`, `@DisabledOnJre`, `@EnabledForJreRange`, or `@DisabledForJreRange`) are redundant or even invalid after upgrading to 6.0. Moreover, the `JRE.JAVA_8` to `JRE.JAVA_16` enum constants have been deprecated.

For example, if a test class or method is annotated with `@EnabledOnJre(JRE.JAVA_8)`, it is now always skipped. Similarly, if a `@DisabledOnJre(JRE.JAVA_8)` annotation is present, it is never skipped. In both cases, the annotation should be removed; in the former case along with the test class/method.

Since 17 is now the default, using one of the range-based annotations with 17 as the minimum version will now fail (as it did previously when using 8 as minimum). For example, `@EnabledForJreRange(minVersion = 17)` is redundant and should be removed.

#### Extensions

Due to the adoption of JSpecify, the `ExtensionContext.Store` API was revised.
Jupiter extension implementations should be changed to call the new `computeIfAbsent` family of methods rather than the now deprecated `getOrComputeIfAbsent` ones.

##### 5.x.y

```java
store.getOrComputeIfAbsent(MyType.class);                             // <1> returns MyType
store.getOrComputeIfAbsent("key", key -> new MyType());               // <2> returns @Nullable Object
store.getOrComputeIfAbsent("key", key -> new MyType(), MyType.class); // <3> returns @Nullable MyType
```

##### 6.0.0

```java
store.computeIfAbsent(MyType.class);                                  // <1> returns MyType
store.computeIfAbsent("key", key -> new MyType());                    // <2> returns Object
store.computeIfAbsent("key", key -> new MyType(), MyType.class);      // <3> returns MyType
```
