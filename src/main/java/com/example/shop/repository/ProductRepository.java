package com.example.shop.repository;

import com.example.shop.entity.Product;
import javax.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {
    List<Product> findByIsFeaturedTrueOrderByIdAsc();
    @Query("select p from Product p where p.isFeatured = true"
            + " and (p.status is null or upper(p.status) = 'ACTIVE')"
            + " and p.name is not null and p.name <> ''"
            + " and p.price is not null and p.price > 0"
            + " and p.categoryId is not null and p.categoryId > 0"
            + " and (p.stock is null or p.stock > 0)"
            + " order by p.id asc")
    List<Product> findPublicFeaturedProducts(Pageable pageable);
    List<Product> findByCategoryId(Long categoryId);
    boolean existsByCategoryId(Long categoryId);
    boolean existsByCategoryIdAndNameIgnoreCase(Long categoryId, String name);
    boolean existsByCategoryIdAndNameIgnoreCaseAndIdNot(Long categoryId, String name, Long id);
    @Query("select p from Product p where p.categoryId = :categoryId"
            + " and (p.status is null or upper(p.status) = 'ACTIVE')"
            + " and p.name is not null and p.name <> ''"
            + " and p.price is not null and p.price > 0"
            + " and (p.stock is null or p.stock > 0)"
            + " order by p.id asc")
    List<Product> findActiveByCategoryId(@Param("categoryId") Long categoryId, Pageable pageable);
    @Query("select p from Product p where (p.status is null or upper(p.status) = 'ACTIVE')"
            + " and p.name is not null and p.name <> ''"
            + " and p.price is not null and p.price > 0"
            + " and p.categoryId is not null and p.categoryId > 0"
            + " and (p.stock is null or p.stock > 0)"
            + " order by case when p.isFeatured = true then 0 else 1 end, p.id asc")
    List<Product> findPublicSellableCandidateWindow(Pageable pageable);
    @Query("select p from Product p where (p.status is null or upper(p.status) = 'ACTIVE')"
            + " and p.name is not null and p.name <> ''"
            + " and p.price is not null and p.price > 0"
            + " and p.categoryId is not null and p.categoryId > 0"
            + " and (p.stock is null or p.stock > 0)"
            + " and p.price >= :floorPrice"
            + " and (p.price <= :ceilingPrice or p.price >= :targetPrice)"
            + " order by case when p.price >= :targetPrice then 0 else 1 end, p.price asc, p.id asc")
    List<Product> findPublicAddOnCandidateWindow(@Param("floorPrice") BigDecimal floorPrice,
                                                 @Param("ceilingPrice") BigDecimal ceilingPrice,
                                                 @Param("targetPrice") BigDecimal targetPrice,
                                                 Pageable pageable);
    @Query("select p from Product p where (p.status is null or upper(p.status) = 'ACTIVE')"
            + " and p.name is not null and p.name <> ''"
            + " and p.price is not null and p.price > 0"
            + " and p.categoryId is not null and p.categoryId > 0"
            + " and (p.stock is null or p.stock > 0)"
            + " and (lower(coalesce(p.name, '')) like concat('%', :keyword, '%') escape '!'"
            + " or lower(coalesce(p.description, '')) like concat('%', :keyword, '%') escape '!'"
            + " or lower(coalesce(p.brand, '')) like concat('%', :keyword, '%') escape '!'"
            + " or lower(coalesce(p.tag, '')) like concat('%', :keyword, '%') escape '!')"
            + " order by case when p.isFeatured = true then 0 else 1 end, p.id asc")
    List<Product> findPublicKeywordCandidateWindow(@Param("keyword") String keyword, Pageable pageable);
    List<Product> findByCategoryIdIn(List<Long> categoryIds);
    List<Product> findByNameContainingIgnoreCase(String keyword);
    Page<Product> findAll(Pageable pageable);
    @Query("select count(p) as totalProducts,"
            + " sum(case when upper(coalesce(p.status, '')) = 'ACTIVE' then 1 else 0 end) as activeProducts,"
            + " sum(case when upper(coalesce(p.status, '')) = 'INACTIVE' then 1 else 0 end) as inactiveProducts,"
            + " sum(case when upper(coalesce(p.status, '')) = 'PENDING_REVIEW' then 1 else 0 end) as pendingProducts,"
            + " sum(case when p.stock is not null and p.stock < 10 then 1 else 0 end) as lowStockProducts"
            + " from Product p")
    ProductDashboardCounts countDashboardProductCounts();
    @Query("select count(p) from Product p where upper(coalesce(p.status, '')) = 'ACTIVE'")
    long countActiveProducts();
    @Query("select p.categoryId, count(p) from Product p where p.categoryId in :categoryIds"
            + " and (p.status is null or upper(p.status) = 'ACTIVE')"
            + " and p.name is not null and p.name <> ''"
            + " and p.price is not null and p.price > 0"
            + " and p.categoryId is not null and p.categoryId > 0"
            + " group by p.categoryId")
    List<Object[]> countPublicProductsByCategoryIds(@Param("categoryIds") List<Long> categoryIds);
    long countByCategoryIdInAndStatusIgnoreCase(List<Long> categoryIds, String status);
    @Query("select count(p) from Product p where upper(coalesce(p.status, '')) = 'PENDING_REVIEW'")
    long countPendingReviewProducts();
    @Query("select count(p) from Product p where p.stock is not null and p.stock < 10")
    long countLowStockProducts();
    @Query("select p from Product p where p.stock is not null and p.stock < 10 order by p.stock asc, p.id asc")
    List<Product> findLowStockProducts(Pageable pageable);

    @Query("select p.id, p.variants from Product p where p.variants is not null and p.variants <> '' order by p.id asc")
    List<Object[]> findVariantSkuOwnerRows(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id in :ids")
    List<Product> findAllByIdForUpdate(@Param("ids") List<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Product findByIdForUpdate(@Param("id") Long id);

    @Modifying
    @Query(value = "update products set stock = stock - :quantity,"
            + " is_featured = case when (stock - :quantity) <= 0 then false else is_featured end,"
            + " updated_at = current_timestamp"
            + " where id = :productId and stock >= :quantity",
            nativeQuery = true)
    int decreaseStock(@Param("productId") Long productId, @Param("quantity") Integer quantity);

    @Modifying
    @Query(value = "update products set stock = coalesce(stock, 0) + :quantity, updated_at = current_timestamp"
            + " where id = :productId",
            nativeQuery = true)
    int increaseStock(@Param("productId") Long productId, @Param("quantity") Integer quantity);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Product p set p.status = :status, p.updatedAt = CURRENT_TIMESTAMP where p.id in :ids")
    int updateStatusByIdIn(@Param("ids") List<Long> ids, @Param("status") String status);

    interface ProductDashboardCounts {
        Long getTotalProducts();
        Long getActiveProducts();
        Long getInactiveProducts();
        Long getPendingProducts();
        Long getLowStockProducts();
    }
}
