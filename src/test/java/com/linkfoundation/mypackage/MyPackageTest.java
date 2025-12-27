package com.linkfoundation.mypackage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Unit tests for {@link MyPackage}. */
@DisplayName("MyPackage")
class MyPackageTest {

  @Nested
  @DisplayName("add()")
  class AddTests {

    @Test
    @DisplayName("adds positive numbers correctly")
    void addsPositiveNumbers() {
      assertEquals(5, MyPackage.add(2, 3));
    }

    @Test
    @DisplayName("adds negative numbers correctly")
    void addsNegativeNumbers() {
      assertEquals(-5, MyPackage.add(-2, -3));
    }

    @Test
    @DisplayName("handles zero correctly")
    void handlesZero() {
      assertEquals(5, MyPackage.add(5, 0));
      assertEquals(5, MyPackage.add(0, 5));
      assertEquals(0, MyPackage.add(0, 0));
    }

    @Test
    @DisplayName("handles mixed positive and negative numbers")
    void handlesMixedNumbers() {
      assertEquals(-2, MyPackage.add(5, -7));
      assertEquals(2, MyPackage.add(-5, 7));
    }

    @Test
    @DisplayName("handles large numbers")
    void handlesLargeNumbers() {
      assertEquals(3_000_000, MyPackage.add(1_000_000, 2_000_000));
    }

    @ParameterizedTest(name = "{0} + {1} = {2}")
    @CsvSource({"1, 1, 2", "2, 3, 5", "-1, 1, 0", "0, 0, 0", "100, -50, 50"})
    @DisplayName("parameterized addition tests")
    void parameterizedAdd(long a, long b, long expected) {
      assertEquals(expected, MyPackage.add(a, b));
    }
  }

  @Nested
  @DisplayName("multiply()")
  class MultiplyTests {

    @Test
    @DisplayName("multiplies positive numbers correctly")
    void multipliesPositiveNumbers() {
      assertEquals(6, MyPackage.multiply(2, 3));
    }

    @Test
    @DisplayName("multiplies negative numbers correctly")
    void multipliesNegativeNumbers() {
      assertEquals(6, MyPackage.multiply(-2, -3));
    }

    @Test
    @DisplayName("handles zero correctly")
    void handlesZero() {
      assertEquals(0, MyPackage.multiply(5, 0));
      assertEquals(0, MyPackage.multiply(0, 5));
      assertEquals(0, MyPackage.multiply(0, 0));
    }

    @Test
    @DisplayName("handles mixed positive and negative numbers")
    void handlesMixedNumbers() {
      assertEquals(-35, MyPackage.multiply(5, -7));
      assertEquals(-35, MyPackage.multiply(-5, 7));
    }

    @Test
    @DisplayName("handles large numbers")
    void handlesLargeNumbers() {
      assertEquals(1_000_000, MyPackage.multiply(1_000, 1_000));
    }

    @ParameterizedTest(name = "{0} * {1} = {2}")
    @CsvSource({"1, 1, 1", "2, 3, 6", "-1, 1, -1", "0, 100, 0", "10, -5, -50"})
    @DisplayName("parameterized multiplication tests")
    void parameterizedMultiply(long a, long b, long expected) {
      assertEquals(expected, MyPackage.multiply(a, b));
    }
  }

  @Nested
  @DisplayName("delay()")
  class DelayTests {

    @Test
    @DisplayName("returns a CompletableFuture")
    void returnsCompletableFuture() {
      CompletableFuture<Void> future = MyPackage.delay(10);
      assertNotNull(future);
      future.join(); // Wait for completion
    }

    @Test
    @DisplayName("delays for approximately the specified time")
    void delaysCorrectly() {
      long startTime = System.currentTimeMillis();
      MyPackage.delay(100).join();
      long elapsed = System.currentTimeMillis() - startTime;

      // Allow generous tolerance for CI environments with timing variations
      assertTrue(elapsed >= 90, "Delay should be at least 90ms but was " + elapsed + "ms");
      assertTrue(elapsed < 500, "Delay should be less than 500ms but was " + elapsed + "ms");
    }

    @Test
    @DisplayName("handles zero delay")
    void handlesZeroDelay() {
      CompletableFuture<Void> future = MyPackage.delay(0);
      assertNotNull(future);
      future.join();
    }

    @Test
    @DisplayName("throws exception for negative delay")
    void throwsForNegativeDelay() {
      assertThrows(IllegalArgumentException.class, () -> MyPackage.delay(-1));
    }
  }

  @Nested
  @DisplayName("VERSION")
  class VersionTests {

    @Test
    @DisplayName("version is not null")
    void versionNotNull() {
      assertNotNull(MyPackage.VERSION);
    }

    @Test
    @DisplayName("version follows semantic versioning format")
    void versionFollowsSemver() {
      assertTrue(
          MyPackage.VERSION.matches("\\d+\\.\\d+\\.\\d+"),
          "Version should match X.Y.Z format but was: " + MyPackage.VERSION);
    }
  }
}
