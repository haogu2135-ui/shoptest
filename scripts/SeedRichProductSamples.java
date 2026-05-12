import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SeedRichProductSamples {
    private static final String DEFAULT_URL = "jdbc:mysql://localhost:3306/shop?useUnicode=true&characterEncoding=utf8&connectionCollation=utf8mb4_unicode_ci&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
    private static final String DEFAULT_USER = "root";
    private static final String DEFAULT_PASSWORD = "84813378";

    public static void main(String[] args) throws Exception {
        String url = envOrDefault("DB_URL", DEFAULT_URL);
        String user = envOrDefault("DB_USERNAME", DEFAULT_USER);
        String password = envOrDefault("DB_PASSWORD", DEFAULT_PASSWORD);

        try (Connection connection = DriverManager.getConnection(url, user, password)) {
            Map<String, Long> categories = loadCategories(connection);
            List<ProductSeed> seeds = buildSeeds();
            int inserted = 0;
            int skipped = 0;
            try (PreparedStatement statement = connection.prepareStatement(upsertSql())) {
                for (ProductSeed seed : seeds) {
                    Long categoryId = categories.get(seed.categoryName);
                    if (categoryId == null) {
                        System.out.println("Skipped missing category: " + seed.categoryName + " -> " + seed.name);
                        skipped++;
                        continue;
                    }
                    bind(statement, seed, categoryId);
                    statement.executeUpdate();
                    inserted++;
                }
            }
            System.out.println("Rich product samples upserted: " + inserted);
            System.out.println("Skipped because category was missing: " + skipped);
            System.out.println("Total products after seed: " + countProducts(connection));
        }
    }

    private static Map<String, Long> loadCategories(Connection connection) throws SQLException {
        Map<String, Long> categories = new HashMap<>();
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT id, name FROM categories")) {
            while (resultSet.next()) {
                categories.put(resultSet.getString("name"), resultSet.getLong("id"));
            }
        }
        return categories;
    }

    private static List<ProductSeed> buildSeeds() {
        List<ProductSeed> seeds = new ArrayList<>();
        seeds.add(product(9201, "NutriTail Adult Dog Salmon & Rice 5kg", "Dog Food", "NutriTail", "hot",
                "Balanced salmon and rice dry food for adult dogs with sensitive stomachs.", "128.90", "159.90", "19",
                "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=1000&q=80",
                "Digestive support", "Real salmon is paired with rice, prebiotic fiber and balanced minerals for everyday feeding.",
                "Dog", "5 kg", "Salmon and rice", "Adult"));
        seeds.add(product(9202, "CanineCore Puppy Chicken Bites 500g", "Dog Food", "CanineCore", "new",
                "Soft puppy training treats with small portions for quick rewards.", "42.90", "55.90", "23",
                "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&q=80",
                "Training friendly", "Small soft bites help keep recall, crate and leash training fast and positive.",
                "Dog", "500 g", "Chicken", "Puppy"));
        seeds.add(product(9203, "NutriTail Indoor Cat Hairball Control 3kg", "Cat Food", "NutriTail", "hot",
                "Indoor cat food with fiber blend, taurine and controlled calories.", "96.90", "119.90", "19",
                "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=1000&q=80",
                "Indoor formula", "A fiber-focused formula helps support hairball control while taurine supports daily cat health.",
                "Cat", "3 kg", "Chicken", "Adult"));
        seeds.add(product(9204, "HydraWhisk Tuna Creamy Cat Treats 24 Pack", "Cat Food", "HydraWhisk", "new",
                "Creamy tuna treats for bonding, topping meals or hiding supplements.", "64.90", "79.90", "19",
                "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1000&q=80",
                "High moisture snack", "Each tube is portioned for hand feeding, meal topping or calm grooming rewards.",
                "Cat", "24 tubes", "Tuna", "All life stages"));
        seeds.add(product(9205, "PawPilot Smart Feeder Mini 2L", "Automatic Feeders", "PawPilot", "hot",
                "Compact automatic feeder for cats and small dogs with app schedules.", "118.90", "149.90", "21",
                "https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1601758123927-1967a0d5f11b?auto=format&fit=crop&w=1000&q=80",
                "App schedule", "Schedule up to six meals a day, tune portion size and keep kibble sealed between feedings.",
                "Cat, Small dog", "2 L", "Dry food", "USB-C"));
        seeds.add(product(9206, "PawPilot Dual Bowl Slow Feeder Station", "Bowls, Feeders & Waterers", "PawPilot", "discount",
                "Raised feeding station with stainless bowls and a slow-feeder insert.", "72.90", "94.90", "23",
                "https://images.unsplash.com/photo-1601758123927-1967a0d5f11b?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=1000&q=80",
                "Better posture", "The raised stand keeps food and water organized while the insert slows fast eaters.",
                "Cat, Dog", "2 bowls", "Stainless steel", "Dishwasher safe"));
        seeds.add(product(9207, "HydraWhisk Ceramic Flow Fountain 2.8L", "Water Fountains", "HydraWhisk", "hot",
                "Ceramic pet fountain with quiet pump and layered filtration.", "88.90", "109.90", "19",
                "https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1000&q=80",
                "Quiet hydration", "A gentle stream and ceramic bowl encourage pets to drink while staying easy to clean.",
                "Cat, Small dog", "2.8 L", "Ceramic", "Replaceable filter"));
        seeds.add(product(9208, "CloudNap Cooling Sofa Bed", "Beds & Furniture", "CloudNap", "new",
                "Sofa-style bed with cooling top fabric and washable cover.", "139.90", "169.90", "18",
                "https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=80",
                "Summer comfort", "Cooling fabric, supportive side bolsters and a removable cover make this bed easy to live with.",
                "Dog", "M/L", "Cooling fabric", "Machine washable"));
        seeds.add(product(9209, "CloudNap Window Hammock for Cats", "Beds & Furniture", "CloudNap", "hot",
                "Sunny window hammock with reinforced suction cups for cats.", "58.90", "74.90", "21",
                "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1000&q=80",
                "Vertical rest", "Gives cats a warm lookout spot while freeing floor space in small apartments.",
                "Cat", "Up to 18 kg", "Steel cable", "Tool-free mount"));
        seeds.add(product(9210, "BrightBite Puzzle Treat Spinner", "Interactive Toys", "BrightBite", "new",
                "Adjustable puzzle toy that releases treats during supervised play.", "36.90", "49.90", "26",
                "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=80",
                "Mental enrichment", "Three difficulty openings let you increase challenge as your pet learns the game.",
                "Cat, Dog", "One size", "ABS", "Adjustable difficulty"));
        seeds.add(product(9211, "BrightBite Rope & Rubber Chew Trio", "Toys & Enrichment", "BrightBite", "discount",
                "Three-piece chew set for tug, fetch and dental enrichment.", "45.90", "62.90", "27",
                "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1000&q=80",
                "Chew variety", "A mixed set helps rotate play styles and keeps supervised sessions more interesting.",
                "Dog", "3 pieces", "Cotton rope, rubber", "Fetch and tug"));
        seeds.add(product(9212, "PurePaws Aloe Grooming Wipes 120 Count", "Grooming & Hygiene", "PurePaws", "hot",
                "Large aloe wipes for paws, coat touch-ups and travel cleanups.", "32.90", "42.90", "23",
                "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1601758123927-1967a0d5f11b?auto=format&fit=crop&w=1000&q=80",
                "Daily cleanup", "Use after walks, before getting into the car or between full baths.",
                "Cat, Dog", "120 wipes", "Aloe", "Alcohol free"));
        seeds.add(product(9213, "PurePaws Deshedding Brush Pro", "Grooming & Hygiene", "PurePaws", "new",
                "Comfort-grip deshedding brush for long and short coats.", "48.90", "64.90", "25",
                "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1000&q=80",
                "Coat control", "Rounded pins and a quick-clean button make grooming sessions faster and more comfortable.",
                "Cat, Dog", "One size", "Stainless steel", "Quick clean"));
        seeds.add(product(9214, "TrailTails Reflective City Leash 1.8m", "Harnesses & Leashes", "TrailTails", "hot",
                "Reflective leash with padded handle and traffic control loop.", "39.90", "52.90", "25",
                "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1000&q=80",
                "Night visibility", "Reflective stitching and a second handle give better control on busy sidewalks.",
                "Dog", "1.8 m", "Nylon", "Padded handle"));
        seeds.add(product(9215, "TrailTails Airline Soft Carrier", "Walking & Travel", "TrailTails", "new",
                "Soft-sided carrier with mesh panels, shoulder strap and washable mat.", "118.90", "149.90", "21",
                "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1000&q=80",
                "Travel ready", "Mesh ventilation, luggage sleeve and a soft mat make short trips easier.",
                "Cat, Small dog", "Cabin size", "Oxford fabric", "Washable mat"));
        seeds.add(product(9216, "PawPilot Pet Supplies Starter Crate", "Pet Supplies", "PawPilot", "discount",
                "A broad starter crate with bowls, wipes, toys and walking basics.", "199.90", "249.90", "20",
                "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1000&q=80",
                "https://images.unsplash.com/photo-1601758123927-1967a0d5f11b?auto=format&fit=crop&w=1000&q=80",
                "Starter bundle", "A high-value bundle for testing cart totals, free shipping, discounts and rich details together.",
                "Cat, Dog", "8 items", "Mixed", "Giftable box"));
        return seeds;
    }

    private static ProductSeed product(int id, String name, String categoryName, String brand, String tag,
                                       String description, String price, String originalPrice, String discount,
                                       String heroImage, String secondaryImage, String headline, String detailText,
                                       String petSize, String pack, String materialOrFlavor, String feature) {
        ProductSeed seed = new ProductSeed();
        seed.id = id;
        seed.name = name;
        seed.categoryName = categoryName;
        seed.brand = brand;
        seed.tag = tag;
        seed.description = description;
        seed.price = new BigDecimal(price);
        seed.originalPrice = new BigDecimal(originalPrice);
        seed.discount = Integer.parseInt(discount);
        seed.stock = 35 + (id % 9) * 13;
        seed.imageUrl = heroImage;
        seed.imagesJson = jsonArray(heroImage, secondaryImage);
        seed.specificationsJson = objectJson(
                "Pet Size", petSize,
                "Pack", pack,
                "Material / Flavor", materialOrFlavor,
                "Feature", feature,
                "Market", "Mexico test catalog",
                "options.Size", "Small,Medium,Large",
                "options.Color", "Orange,Teal,Graphite"
        );
        seed.detailContentJson = detailJson(name, headline, detailText, heroImage, secondaryImage);
        seed.variantsJson = variantsJson(seed.price);
        seed.warranty = "Demo warranty: 30 days replacement for manufacturing defects.";
        seed.shipping = "Ships from Mexico test warehouse. Free shipping follows the store threshold.";
        seed.featured = id % 3 == 0;
        seed.freeShipping = id % 4 == 0;
        seed.freeShippingThreshold = new BigDecimal("899.00");
        return seed;
    }

    private static String detailJson(String name, String headline, String detailText, String heroImage, String secondaryImage) {
        return "[" +
                objectJson("type", "text", "content", headline + ". " + detailText) + "," +
                objectJson("type", "image", "url", heroImage, "caption", name + " lifestyle view") + "," +
                objectJson("type", "text", "content", "Designed for the Mexico storefront test flow: product list cards, detail page media, mobile scrolling and checkout summaries all have enough content to exercise layout.") + "," +
                objectJson("type", "image", "url", secondaryImage, "caption", "Material and daily-use detail") + "," +
                objectJson("type", "text", "content", "Use this sample to test long descriptions, paragraph wrapping, rich media ordering, customer support references and admin live preview behavior.") + "," +
                objectJson("type", "video", "url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "caption", "Demo embedded video block") + "," +
                objectJson("type", "text", "content", "Care tip: introduce new pet products slowly, supervise first use and check sizing before removing tags. This final paragraph intentionally adds more content for realistic product detail density.") +
                "]";
    }

    private static String variantsJson(BigDecimal basePrice) {
        BigDecimal medium = basePrice.add(new BigDecimal("8.00"));
        BigDecimal large = basePrice.add(new BigDecimal("16.00"));
        return "[" +
                objectJson("sku", "S-ORG", "options", objectJson("Size", "Small", "Color", "Orange"), "price", basePrice.toPlainString(), "stock", "24", "imageUrl", "") + "," +
                objectJson("sku", "M-TEAL", "options", objectJson("Size", "Medium", "Color", "Teal"), "price", medium.toPlainString(), "stock", "18", "imageUrl", "") + "," +
                objectJson("sku", "L-GPH", "options", objectJson("Size", "Large", "Color", "Graphite"), "price", large.toPlainString(), "stock", "12", "imageUrl", "") +
                "]";
    }

    private static String upsertSql() {
        return "INSERT INTO products (" +
                "id, name, description, price, stock, category_id, image_url, status, brand, " +
                "original_price, discount, limited_time_price, limited_time_start_at, limited_time_end_at, " +
                "tag, images, specifications, detail_content, variants, warranty, shipping, free_shipping, free_shipping_threshold, is_featured, created_at, updated_at" +
                ") VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 45 DAY), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) " +
                "ON DUPLICATE KEY UPDATE " +
                "name=VALUES(name), description=VALUES(description), price=VALUES(price), stock=VALUES(stock), category_id=VALUES(category_id), " +
                "image_url=VALUES(image_url), status=VALUES(status), brand=VALUES(brand), original_price=VALUES(original_price), discount=VALUES(discount), " +
                "limited_time_price=VALUES(limited_time_price), limited_time_start_at=VALUES(limited_time_start_at), limited_time_end_at=VALUES(limited_time_end_at), " +
                "tag=VALUES(tag), images=VALUES(images), specifications=VALUES(specifications), detail_content=VALUES(detail_content), variants=VALUES(variants), " +
                "warranty=VALUES(warranty), shipping=VALUES(shipping), free_shipping=VALUES(free_shipping), free_shipping_threshold=VALUES(free_shipping_threshold), " +
                "is_featured=VALUES(is_featured), updated_at=NOW()";
    }

    private static void bind(PreparedStatement statement, ProductSeed seed, Long categoryId) throws SQLException {
        int index = 1;
        statement.setInt(index++, seed.id);
        statement.setString(index++, seed.name);
        statement.setString(index++, seed.description);
        statement.setBigDecimal(index++, seed.price);
        statement.setInt(index++, seed.stock);
        statement.setLong(index++, categoryId);
        statement.setString(index++, seed.imageUrl);
        statement.setString(index++, seed.brand);
        statement.setBigDecimal(index++, seed.originalPrice);
        statement.setInt(index++, seed.discount);
        statement.setBigDecimal(index++, seed.price.subtract(new BigDecimal("10.00")));
        statement.setString(index++, seed.tag);
        statement.setString(index++, seed.imagesJson);
        statement.setString(index++, seed.specificationsJson);
        statement.setString(index++, seed.detailContentJson);
        statement.setString(index++, seed.variantsJson);
        statement.setString(index++, seed.warranty);
        statement.setString(index++, seed.shipping);
        statement.setBoolean(index++, seed.freeShipping);
        statement.setBigDecimal(index++, seed.freeShippingThreshold);
        statement.setBoolean(index, seed.featured);
    }

    private static long countProducts(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT COUNT(*) FROM products")) {
            resultSet.next();
            return resultSet.getLong(1);
        }
    }

    private static String envOrDefault(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private static String jsonArray(String... values) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                builder.append(",");
            }
            builder.append("\"").append(escape(values[i])).append("\"");
        }
        return builder.append("]").toString();
    }

    private static String objectJson(String... pairs) {
        StringBuilder builder = new StringBuilder("{");
        for (int i = 0; i < pairs.length; i += 2) {
            if (i > 0) {
                builder.append(",");
            }
            builder.append("\"").append(escape(pairs[i])).append("\":");
            String value = pairs[i + 1];
            if (value != null && (value.startsWith("{") || value.startsWith("["))) {
                builder.append(value);
            } else if (value != null && value.matches("-?\\d+(\\.\\d+)?")) {
                builder.append(value);
            } else {
                builder.append("\"").append(escape(value)).append("\"");
            }
        }
        return builder.append("}").toString();
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static class ProductSeed {
        int id;
        String name;
        String categoryName;
        String brand;
        String tag;
        String description;
        BigDecimal price;
        BigDecimal originalPrice;
        int discount;
        int stock;
        String imageUrl;
        String imagesJson;
        String specificationsJson;
        String detailContentJson;
        String variantsJson;
        String warranty;
        String shipping;
        boolean freeShipping;
        BigDecimal freeShippingThreshold;
        boolean featured;
    }
}
