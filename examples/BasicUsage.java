package examples;

import com.linkfoundation.mypackage.MyPackage;

/**
 * Example demonstrating basic usage of the MyPackage library.
 *
 * <p>This example shows how to use the core functionality: arithmetic operations and async delays.
 *
 * <p>To run this example:
 *
 * <pre>
 * mvn compile
 * mvn exec:java -Dexec.mainClass="examples.BasicUsage" -Dexec.classpathScope=compile
 * </pre>
 *
 * Or run directly with:
 *
 * <pre>
 * java -cp target/classes examples.BasicUsage
 * </pre>
 */
public final class BasicUsage {

  private BasicUsage() {
    // Private constructor to prevent instantiation
  }

  /**
   * Main entry point for the example.
   *
   * @param args command line arguments (not used)
   */
  public static void main(String[] args) {
    System.out.println("=== MyPackage Basic Usage Example ===");
    System.out.println("Version: " + MyPackage.VERSION);
    System.out.println();

    // Demonstrate addition
    demonstrateAddition();

    // Demonstrate multiplication
    demonstrateMultiplication();

    // Demonstrate async delay
    demonstrateDelay();

    System.out.println("=== Example Complete ===");
  }

  private static void demonstrateAddition() {
    System.out.println("--- Addition Examples ---");

    // Simple addition
    long result1 = MyPackage.add(10, 20);
    System.out.println("10 + 20 = " + result1);

    // Adding negative numbers
    long result2 = MyPackage.add(-5, 15);
    System.out.println("-5 + 15 = " + result2);

    // Adding large numbers
    long result3 = MyPackage.add(1_000_000_000L, 2_000_000_000L);
    System.out.println("1,000,000,000 + 2,000,000,000 = " + result3);

    System.out.println();
  }

  private static void demonstrateMultiplication() {
    System.out.println("--- Multiplication Examples ---");

    // Simple multiplication
    long result1 = MyPackage.multiply(6, 7);
    System.out.println("6 * 7 = " + result1);

    // Multiplying by zero
    long result2 = MyPackage.multiply(100, 0);
    System.out.println("100 * 0 = " + result2);

    // Multiplying negative numbers
    long result3 = MyPackage.multiply(-3, -4);
    System.out.println("-3 * -4 = " + result3);

    System.out.println();
  }

  private static void demonstrateDelay() {
    System.out.println("--- Async Delay Example ---");

    System.out.println("Starting 200ms delay...");
    long startTime = System.currentTimeMillis();

    // Perform async delay and wait for completion
    MyPackage.delay(200).join();

    long elapsed = System.currentTimeMillis() - startTime;
    System.out.println("Delay completed in " + elapsed + "ms");

    System.out.println();
  }
}
