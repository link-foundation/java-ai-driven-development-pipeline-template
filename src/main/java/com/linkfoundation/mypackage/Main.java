package com.linkfoundation.mypackage;

/**
 * Example binary entry point.
 *
 * <p>This class demonstrates basic usage of the MyPackage library functions. It can be run directly
 * to see the library in action.
 */
public final class Main {

  private Main() {
    // Private constructor to prevent instantiation
  }

  /**
   * Main entry point demonstrating library usage.
   *
   * @param args command line arguments (not used)
   */
  public static void main(String[] args) {
    System.out.println("MyPackage v" + MyPackage.VERSION);
    System.out.println();

    // Example 1: Basic arithmetic
    System.out.println("Example 1: Basic arithmetic");
    long sum = MyPackage.add(2, 3);
    long product = MyPackage.multiply(4, 5);
    System.out.println("  2 + 3 = " + sum);
    System.out.println("  4 * 5 = " + product);
    System.out.println();

    // Example 2: Larger numbers
    System.out.println("Example 2: Larger numbers");
    long largeSum = MyPackage.add(1_000_000, 2_000_000);
    long largeProduct = MyPackage.multiply(1_000, 1_000);
    System.out.println("  1,000,000 + 2,000,000 = " + largeSum);
    System.out.println("  1,000 * 1,000 = " + largeProduct);
    System.out.println();

    // Example 3: Negative numbers
    System.out.println("Example 3: Negative numbers");
    long negSum = MyPackage.add(-5, 3);
    long negProduct = MyPackage.multiply(-4, 5);
    System.out.println("  -5 + 3 = " + negSum);
    System.out.println("  -4 * 5 = " + negProduct);
    System.out.println();

    // Example 4: Async delay
    System.out.println("Example 4: Async delay");
    System.out.println("  Waiting for 100ms...");
    long start = System.currentTimeMillis();
    MyPackage.delay(100).join();
    long elapsed = System.currentTimeMillis() - start;
    System.out.println("  Waited for " + elapsed + "ms");
    System.out.println();

    System.out.println("Done!");
  }
}
