package com.linkfoundation.mypackage;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Main library class providing arithmetic operations and utility functions.
 *
 * <p>This class provides simple mathematical operations and async utilities as a template for
 * AI-driven development.
 *
 * <p>Example usage:
 *
 * <pre>{@code
 * long sum = MyPackage.add(2, 3);      // Returns 5
 * long product = MyPackage.multiply(4, 5);  // Returns 20
 * MyPackage.delay(1000).join();        // Waits for 1 second
 * }</pre>
 */
public final class MyPackage {

  /** The current version of the package. */
  public static final String VERSION = "0.2.0";

  private MyPackage() {
    // Private constructor to prevent instantiation
  }

  /**
   * Adds two numbers together.
   *
   * @param a the first number
   * @param b the second number
   * @return the sum of a and b
   */
  public static long add(long a, long b) {
    return a + b;
  }

  /**
   * Multiplies two numbers together.
   *
   * @param a the first number
   * @param b the second number
   * @return the product of a and b
   */
  public static long multiply(long a, long b) {
    return a * b;
  }

  /**
   * Delays execution for the specified number of milliseconds.
   *
   * <p>This method returns a CompletableFuture that completes after the specified delay. The delay
   * is non-blocking and can be awaited using {@code join()} or composed with other async
   * operations.
   *
   * @param milliseconds the number of milliseconds to delay
   * @return a CompletableFuture that completes after the delay
   * @throws IllegalArgumentException if milliseconds is negative
   */
  public static CompletableFuture<Void> delay(long milliseconds) {
    if (milliseconds < 0) {
      throw new IllegalArgumentException("Delay cannot be negative");
    }
    return CompletableFuture.runAsync(
        () -> {
          try {
            TimeUnit.MILLISECONDS.sleep(milliseconds);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
        });
  }
}
